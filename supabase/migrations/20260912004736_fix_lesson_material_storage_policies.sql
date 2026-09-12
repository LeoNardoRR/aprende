-- Qualify storage.objects.name explicitly. Without the qualification,
-- PostgreSQL can resolve name to the classroom alias inside the subquery.
-- The bucket remains private and every path is scoped to its first segment:
-- <classroom_id>/<lesson_record_id>/<uuid>-<file>.

drop policy if exists lesson_material_file_read on storage.objects;
create policy lesson_material_file_read
on storage.objects for select to authenticated
using (
  bucket_id = 'lesson-materials'
  and exists (
    select 1
    from public.classrooms as classroom
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
    select 1
    from public.classrooms as classroom
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
    select 1
    from public.classrooms as classroom
    where classroom.id::text = (storage.foldername(storage.objects.name))[1]
      and (select private.is_class_teacher(classroom.id))
  )
)
with check (
  bucket_id = 'lesson-materials'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1
    from public.classrooms as classroom
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
    select 1
    from public.classrooms as classroom
    where classroom.id::text = (storage.foldername(storage.objects.name))[1]
      and (select private.is_class_teacher(classroom.id))
  )
);
