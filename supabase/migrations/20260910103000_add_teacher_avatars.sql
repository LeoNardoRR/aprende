alter table public.profiles
add column if not exists avatar_url text
check (avatar_url is null or char_length(avatar_url) <= 700);

revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'teacher-avatars',
  'teacher-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists teacher_avatar_insert on storage.objects;
create policy teacher_avatar_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'teacher-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'teacher'
  )
);

drop policy if exists teacher_avatar_update on storage.objects;
create policy teacher_avatar_update
on storage.objects for update to authenticated
using (
  bucket_id = 'teacher-avatars'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'teacher-avatars'
  and owner_id = (select auth.uid()::text)
);

drop policy if exists teacher_avatar_delete on storage.objects;
create policy teacher_avatar_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'teacher-avatars'
  and owner_id = (select auth.uid()::text)
);
