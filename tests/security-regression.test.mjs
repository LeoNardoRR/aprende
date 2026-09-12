import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readMigration = (name) =>
  readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');

const core = readMigration('20260908232436_aprende_core.sql');
const attendance = readMigration('20260911100825_add_classroom_attendance.sql');
const assignmentKind = readMigration('20260911161207_assignment_kind.sql');
const submittedLock = readMigration('20260909123824_lock_submitted_student_work.sql');
const connectedWorkflow = readMigration('20260909124234_harden_connected_workflow.sql');
const scoreValidation = readMigration('20260909124231_validate_activity_scores.sql');
const lesson = readMigration('20260911221817_add_lesson_records_and_materials.sql');
const teacherPortal = readFileSync(
  new URL('../components/teacher-portal.tsx', import.meta.url),
  'utf8',
);

test('classroom content is readable only by members and writable by teachers', () => {
  assert.match(core, /create policy classrooms_read[\s\S]*private\.is_class_member\(id\)/);
  assert.match(core, /create policy classrooms_change[\s\S]*owner_id = \(select auth\.uid\(\)\)/);
  assert.match(core, /create policy assignments_read[\s\S]*private\.is_class_member\(classroom_id\)/);
  assert.match(core, /create policy assignments_create[\s\S]*created_by = \(select auth\.uid\(\)\)[\s\S]*private\.is_class_teacher\(classroom_id\)/);
  assert.match(core, /create policy submissions_create[\s\S]*student_id = \(select auth\.uid\(\)\)/);
  assert.match(core, /create policy submissions_read[\s\S]*student_id = \(select auth\.uid\(\)\)/);
});

test('students can save drafts without gaining score or feedback write access', () => {
  assert.match(core, /grant update \(answer, status, submitted_at, updated_at\) on public\.submissions/);
  assert.doesNotMatch(core, /grant update \([^)]*score/);
  assert.doesNotMatch(core, /grant update \([^)]*feedback/);
  assert.match(connectedWorkflow, /student_id = \(select auth\.uid\(\)\)[\s\S]*score is null/);
});

test('submitted work stays locked and grading is authorized and bounded', () => {
  assert.match(submittedLock, /old\.student_id = auth\.uid\(\)[\s\S]*old\.status = 'submitted'/);
  assert.match(scoreValidation, /s\.status = 'submitted'[\s\S]*c\.owner_id = auth\.uid\(\)/);
  assert.match(scoreValidation, /new_score < 0 or new_score > maximum_points/);
});

test('attendance writes require the teacher of the class and a real member', () => {
  assert.match(attendance, /create policy attendance_create[\s\S]*recorded_by = \(select auth\.uid\(\)\)/);
  assert.match(attendance, /attendance_create[\s\S]*private\.is_class_teacher\(classroom_id\)/);
  assert.match(attendance, /attendance_create[\s\S]*from public\.memberships[\s\S]*user_id = attendance\.student_id/);
  assert.match(attendance, /create policy attendance_change[\s\S]*private\.is_class_teacher\(classroom_id\)/);
});

test('lesson records and files protect member reads and teacher writes', () => {
  assert.match(lesson, /alter table public\.lesson_records enable row level security/);
  assert.match(lesson, /lesson_records_read[\s\S]*private\.is_class_member\(classroom_id\)/);
  assert.match(lesson, /lesson_records_create[\s\S]*teacher_id = \(select auth\.uid\(\)\)[\s\S]*private\.is_class_teacher\(classroom_id\)/);
  assert.match(lesson, /lesson_material_file_read[\s\S]*private\.is_class_member\(classroom\.id\)/);
  assert.match(lesson, /lesson_material_file_insert[\s\S]*private\.is_class_teacher\(classroom\.id\)/);
  assert.match(lesson, /storage\.foldername\(name\)\)\[1\]/);
});

test('assignments preserve task and exam semantics and the dashboard scopes reads', () => {
  assert.match(assignmentKind, /add column if not exists kind text not null default 'task'/);
  assert.match(assignmentKind, /check \(kind in \('task', 'exam'\)\)/);
  assert.doesNotMatch(teacherPortal, /\.in\(['"]classroom_id['"], ids\)/);
  assert.match(teacherPortal, /\.eq\(['"]classroom_id['"], selectedClassId\)/);
});
