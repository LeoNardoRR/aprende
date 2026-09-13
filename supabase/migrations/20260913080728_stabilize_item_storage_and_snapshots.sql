-- Stabilization before Phase 4. This migration is intentionally additive.

-- The original function used local variables named item_id/network_id. Inside
-- its SQL expression those names collide with table columns and PostgreSQL
-- raises 42702. Keep the published signature and qualify every value.
create or replace function private.can_use_item_image(
  object_name text,
  write_access boolean
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[];
  v_item_id uuid;
  v_network_id uuid;
begin
  v_parts := string_to_array(object_name, '/');
  if cardinality(v_parts) <> 3
    or v_parts[3] !~ '^[a-f0-9-]+\.(png|jpg|jpeg|webp)$'
  then
    return false;
  end if;

  begin
    v_network_id := v_parts[1]::uuid;
    v_item_id := v_parts[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return exists (
    select 1
    from public.assessment_items as assessment_item
    where assessment_item.id = v_item_id
      and assessment_item.network_id = v_network_id
  ) and case
    when write_access then private.can_edit_item(v_item_id)
    else private.can_read_item(v_item_id)
  end;
end;
$$;

revoke all on function private.can_use_item_image(text, boolean)
from public, anon, authenticated;
grant execute on function private.can_use_item_image(text, boolean)
to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'assessment-item-images',
  'assessment-item-images',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists item_images_read on storage.objects;
drop policy if exists item_images_insert on storage.objects;
drop policy if exists item_images_delete on storage.objects;

create policy item_images_read
on storage.objects for select to authenticated
using (
  storage.objects.bucket_id = 'assessment-item-images'
  and private.can_use_item_image(storage.objects.name, false)
);

create policy item_images_insert
on storage.objects for insert to authenticated
with check (
  storage.objects.bucket_id = 'assessment-item-images'
  and private.can_use_item_image(storage.objects.name, true)
  and storage.objects.owner_id = (select auth.uid())::text
);

create policy item_images_delete
on storage.objects for delete to authenticated
using (
  storage.objects.bucket_id = 'assessment-item-images'
  and private.can_use_item_image(storage.objects.name, true)
  and not exists (
    select 1
    from public.assessment_item_versions as item_version
    where coalesce(item_version.snapshot -> 'image_paths', '[]'::jsonb)
      ? storage.objects.name
  )
);

-- Recreate the snapshot function after image_paths/formula were added so the
-- frozen representation explicitly includes the complete approved item.
create or replace function private.item_snapshot(target_item uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', item.id,
    'network_id', item.network_id,
    'curriculum_id', item.curriculum_id,
    'curriculum_school_year_id', item.curriculum_school_year_id,
    'subject_id', item.subject_id,
    'skill_id', item.skill_id,
    'thematic_unit_id', item.thematic_unit_id,
    'knowledge_object_id', item.knowledge_object_id,
    'internal_title', item.internal_title,
    'statement', item.statement,
    'support_text', item.support_text,
    'pedagogical_comment', item.pedagogical_comment,
    'correct_answer_justification', item.correct_answer_justification,
    'difficulty', item.difficulty,
    'item_type', item.item_type,
    'formula', item.formula,
    'image_paths', to_jsonb(item.image_paths),
    'author_id', item.author_id,
    'reviewer_id', item.reviewer_id,
    'approver_id', item.approver_id,
    'options', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item_option.id,
          'label', item_option.label,
          'content', item_option.content,
          'is_correct', item_option.is_correct,
          'feedback', item_option.feedback,
          'distractor_analysis', item_option.distractor_analysis,
          'sort_order', item_option.sort_order
        ) order by item_option.sort_order, item_option.label
      )
      from public.assessment_item_options as item_option
      where item_option.item_id = item.id
    ), '[]'::jsonb)
  )
  from public.assessment_items as item
  where item.id = target_item;
$$;

revoke all on function private.item_snapshot(uuid)
from public, anon, authenticated;
