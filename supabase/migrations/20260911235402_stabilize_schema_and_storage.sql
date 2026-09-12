-- Reconcile the production schema with features already present in the app.
-- This migration is intentionally idempotent where possible so it is safe on
-- environments that already received some of these changes manually.

alter table public.assignments
add column if not exists kind text not null default 'task';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assignments_kind_check'
      and conrelid = 'public.assignments'::regclass
  ) then
    alter table public.assignments
      add constraint assignments_kind_check check (kind in ('task', 'exam'));
  end if;
end $$;

alter table public.classrooms
add column if not exists image_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'classrooms_image_url_check'
      and conrelid = 'public.classrooms'::regclass
  ) then
    alter table public.classrooms
      add constraint classrooms_image_url_check
      check (image_url is null or char_length(image_url) <= 700);
  end if;
end $$;

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  present boolean not null default true,
  recorded_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (classroom_id, student_id, attendance_date)
);

create index if not exists attendance_classroom_date_idx
  on public.attendance (classroom_id, attendance_date desc);
create index if not exists attendance_student_date_idx
  on public.attendance (student_id, attendance_date desc);
create index if not exists attendance_recorded_by_idx
  on public.attendance (recorded_by);
create index if not exists lesson_records_teacher_id_idx
  on public.lesson_records (teacher_id);
create index if not exists lesson_materials_teacher_id_idx
  on public.lesson_materials (teacher_id);

alter table public.attendance enable row level security;

drop policy if exists attendance_read on public.attendance;
create policy attendance_read on public.attendance
for select to authenticated
using (
  student_id = (select auth.uid())
  or (select private.is_class_teacher(classroom_id))
);

drop policy if exists attendance_create on public.attendance;
create policy attendance_create on public.attendance
for insert to authenticated
with check (
  recorded_by = (select auth.uid())
  and (select private.is_class_teacher(classroom_id))
  and exists (
    select 1 from public.memberships
    where memberships.classroom_id = attendance.classroom_id
      and memberships.user_id = attendance.student_id
  )
);

drop policy if exists attendance_change on public.attendance;
create policy attendance_change on public.attendance
for update to authenticated
using (
  recorded_by = (select auth.uid())
  and (select private.is_class_teacher(classroom_id))
)
with check (
  recorded_by = (select auth.uid())
  and (select private.is_class_teacher(classroom_id))
  and exists (
    select 1 from public.memberships
    where memberships.classroom_id = attendance.classroom_id
      and memberships.user_id = attendance.student_id
  )
);

grant select, insert, update on public.attendance to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'classroom-images',
  'classroom-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists classroom_image_insert on storage.objects;
create policy classroom_image_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'classroom-images'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'teacher'
  )
);

drop policy if exists classroom_image_update on storage.objects;
create policy classroom_image_update
on storage.objects for update to authenticated
using (
  bucket_id = 'classroom-images'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'classroom-images'
  and owner_id = (select auth.uid()::text)
);

drop policy if exists classroom_image_delete on storage.objects;
create policy classroom_image_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'classroom-images'
  and owner_id = (select auth.uid()::text)
);

-- Fix lesson-material policies by qualifying the storage object path. Without
-- qualification PostgreSQL can bind `name` to classrooms.name in the nested
-- subquery instead of storage.objects.name.
drop policy if exists lesson_material_file_read on storage.objects;
create policy lesson_material_file_read
on storage.objects for select to authenticated
using (
  bucket_id = 'lesson-materials'
  and exists (
    select 1 from public.classrooms classroom
    where classroom.id::text = (storage.foldername(storage.objects.name))[1]
      and (select private.is_class_member(classroom.id))
  )
);

drop policy if exists lesson_material_file_insert on storage.objects;
create policy lesson_material_file_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'lesson-materials'
  and exists (
    select 1 from public.classrooms classroom
    where classroom.id::text = (storage.foldername(storage.objects.name))[1]
      and (select private.is_class_teacher(classroom.id))
  )
);

drop policy if exists lesson_material_file_update on storage.objects;
create policy lesson_material_file_update
on storage.objects for update to authenticated
using (
  bucket_id = 'lesson-materials'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1 from public.classrooms classroom
    where classroom.id::text = (storage.foldername(storage.objects.name))[1]
      and (select private.is_class_teacher(classroom.id))
  )
)
with check (
  bucket_id = 'lesson-materials'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1 from public.classrooms classroom
    where classroom.id::text = (storage.foldername(storage.objects.name))[1]
      and (select private.is_class_teacher(classroom.id))
  )
);

drop policy if exists lesson_material_file_delete on storage.objects;
create policy lesson_material_file_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'lesson-materials'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1 from public.classrooms classroom
    where classroom.id::text = (storage.foldername(storage.objects.name))[1]
      and (select private.is_class_teacher(classroom.id))
  )
);

-- Prevent a lesson material from pointing at a lesson record from another class.
create unique index if not exists lesson_records_id_classroom_uidx
  on public.lesson_records (id, classroom_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lesson_materials_record_classroom_fkey'
      and conrelid = 'public.lesson_materials'::regclass
  ) then
    alter table public.lesson_materials
      add constraint lesson_materials_record_classroom_fkey
      foreign key (lesson_record_id, classroom_id)
      references public.lesson_records(id, classroom_id)
      on delete set null;
  end if;
end $$;
