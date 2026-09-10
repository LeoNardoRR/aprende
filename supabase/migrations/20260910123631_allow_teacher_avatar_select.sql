drop policy if exists teacher_avatar_select on storage.objects;
create policy teacher_avatar_select
on storage.objects for select to authenticated
using (
  bucket_id = 'teacher-avatars'
  and owner_id = (select auth.uid()::text)
);
