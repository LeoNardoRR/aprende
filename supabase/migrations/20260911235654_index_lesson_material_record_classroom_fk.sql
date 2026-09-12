create index if not exists lesson_materials_record_classroom_idx
  on public.lesson_materials (lesson_record_id, classroom_id)
  where lesson_record_id is not null;
