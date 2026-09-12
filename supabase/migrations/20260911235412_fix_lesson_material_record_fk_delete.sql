alter table public.lesson_materials
  drop constraint if exists lesson_materials_record_classroom_fkey;

alter table public.lesson_materials
  add constraint lesson_materials_record_classroom_fkey
  foreign key (lesson_record_id, classroom_id)
  references public.lesson_records(id, classroom_id)
  on delete set null (lesson_record_id);
