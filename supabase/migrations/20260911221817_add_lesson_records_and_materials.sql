create table public.lesson_records (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  lesson_date date not null default current_date,
  title text not null check (char_length(title) between 2 and 160),
  content text not null check (char_length(content) between 2 and 12000),
  observations text not null default '' check (char_length(observations) <= 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lesson_materials (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  lesson_record_id uuid references public.lesson_records(id) on delete set null,
  title text not null check (char_length(title) between 2 and 160),
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique check (char_length(storage_path) between 1 and 700),
  file_type text not null check (char_length(file_type) between 1 and 160),
  file_size bigint not null check (file_size between 1 and 20971520),
  source text not null default 'government' check (source in ('government', 'teacher')),
  created_at timestamptz not null default now()
);

create index lesson_records_classroom_date_idx
on public.lesson_records (classroom_id, lesson_date desc, created_at desc);

create index lesson_materials_classroom_created_idx
on public.lesson_materials (classroom_id, created_at desc);

create index lesson_materials_lesson_record_idx
on public.lesson_materials (lesson_record_id)
where lesson_record_id is not null;

alter table public.lesson_records enable row level security;
alter table public.lesson_materials enable row level security;

create policy lesson_records_read
on public.lesson_records for select to authenticated
using ((select private.is_class_member(classroom_id)));

create policy lesson_records_create
on public.lesson_records for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and (select private.is_class_teacher(classroom_id))
);

create policy lesson_records_change
on public.lesson_records for update to authenticated
using (
  teacher_id = (select auth.uid())
  and (select private.is_class_teacher(classroom_id))
)
with check (
  teacher_id = (select auth.uid())
  and (select private.is_class_teacher(classroom_id))
);

create policy lesson_records_remove
on public.lesson_records for delete to authenticated
using (
  teacher_id = (select auth.uid())
  and (select private.is_class_teacher(classroom_id))
);

create policy lesson_materials_read
on public.lesson_materials for select to authenticated
using ((select private.is_class_member(classroom_id)));

create policy lesson_materials_create
on public.lesson_materials for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and (select private.is_class_teacher(classroom_id))
);

create policy lesson_materials_change
on public.lesson_materials for update to authenticated
using (
  teacher_id = (select auth.uid())
  and (select private.is_class_teacher(classroom_id))
)
with check (
  teacher_id = (select auth.uid())
  and (select private.is_class_teacher(classroom_id))
);

create policy lesson_materials_remove
on public.lesson_materials for delete to authenticated
using (
  teacher_id = (select auth.uid())
  and (select private.is_class_teacher(classroom_id))
);

grant select, insert, update, delete
on public.lesson_records, public.lesson_materials
to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-materials',
  'lesson-materials',
  false,
  20971520,
  null
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy lesson_material_file_read
on storage.objects for select to authenticated
using (
  bucket_id = 'lesson-materials'
  and exists (
    select 1
    from public.classrooms classroom
    where classroom.id::text = (storage.foldername(name))[1]
      and (select private.is_class_member(classroom.id))
  )
);

create policy lesson_material_file_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'lesson-materials'
  and exists (
    select 1
    from public.classrooms classroom
    where classroom.id::text = (storage.foldername(name))[1]
      and (select private.is_class_teacher(classroom.id))
  )
);

create policy lesson_material_file_update
on storage.objects for update to authenticated
using (
  bucket_id = 'lesson-materials'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1
    from public.classrooms classroom
    where classroom.id::text = (storage.foldername(name))[1]
      and (select private.is_class_teacher(classroom.id))
  )
)
with check (
  bucket_id = 'lesson-materials'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1
    from public.classrooms classroom
    where classroom.id::text = (storage.foldername(name))[1]
      and (select private.is_class_teacher(classroom.id))
  )
);

create policy lesson_material_file_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'lesson-materials'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1
    from public.classrooms classroom
    where classroom.id::text = (storage.foldername(name))[1]
      and (select private.is_class_teacher(classroom.id))
  )
);
