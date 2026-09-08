alter table private.teacher_invites enable row level security;

create index classrooms_owner_id_idx on public.classrooms(owner_id);
create index assignments_created_by_idx on public.assignments(created_by);
create index announcements_author_id_idx on public.announcements(author_id);

