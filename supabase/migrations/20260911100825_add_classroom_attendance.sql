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

alter table public.attendance enable row level security;

drop policy if exists attendance_read on public.attendance;
create policy attendance_read on public.attendance for select to authenticated
using (
  student_id = (select auth.uid())
  or (select private.is_class_teacher(classroom_id))
);

drop policy if exists attendance_create on public.attendance;
create policy attendance_create on public.attendance for insert to authenticated
with check (
  recorded_by = (select auth.uid())
  and (select private.is_class_teacher(classroom_id))
  and exists (
    select 1 from public.memberships
    where classroom_id = attendance.classroom_id
      and user_id = attendance.student_id
  )
);

drop policy if exists attendance_change on public.attendance;
create policy attendance_change on public.attendance for update to authenticated
using ((select private.is_class_teacher(classroom_id)))
with check (
  recorded_by = (select auth.uid())
  and (select private.is_class_teacher(classroom_id))
);

grant select, insert, update on public.attendance to authenticated;
