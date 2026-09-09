alter table private.teacher_invites enable row level security;

create index if not exists classrooms_owner_id_idx on public.classrooms(owner_id);
create index if not exists assignments_created_by_idx on public.assignments(created_by);
create index if not exists announcements_author_id_idx on public.announcements(author_id);
