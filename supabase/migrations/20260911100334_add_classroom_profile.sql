alter table public.classrooms
add column if not exists image_url text
check (image_url is null or char_length(image_url) <= 700);

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
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'teacher'
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
