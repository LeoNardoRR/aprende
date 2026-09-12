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
const lesson = readMigration('20260911222656_add_lesson_records_and_materials.sql');
const storagePolicyFix = readMigration(
  '20260912004736_fix_lesson_material_storage_policies.sql',
);
const schemaStabilization = readMigration(
  '20260911235402_stabilize_schema_and_storage.sql',
);
const lessonMaterialFkFix = readMigration(
  '20260911235412_fix_lesson_material_record_fk_delete.sql',
);
const lessonMaterialFkIndex = readMigration(
  '20260911235654_index_lesson_material_record_classroom_fk.sql',
);
const hardenedGrants = readMigration(
  '20260911235837_harden_app_table_grants.sql',
);
const studentConnect = readFileSync(
  new URL('../components/student-connect.tsx', import.meta.url),
  'utf8',
);
const teacherPortal = readFileSync(
  new URL('../components/teacher-portal.tsx', import.meta.url),
  'utf8',
);
const homePage = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');

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
});

test('lesson material storage policies use an explicit private path scope', () => {
  assert.match(storagePolicyFix, /storage\.foldername\(storage\.objects\.name\)/);
  assert.doesNotMatch(storagePolicyFix, /storage\.foldername\(name\)/);
  for (const policy of [
    'lesson_material_file_read',
    'lesson_material_file_insert',
    'lesson_material_file_update',
    'lesson_material_file_delete',
  ]) {
    assert.match(storagePolicyFix, new RegExp(`create policy ${policy}`));
  }
  assert.match(storagePolicyFix, /bucket_id = 'lesson-materials'/);
  assert.match(storagePolicyFix, /for select to authenticated/);
  assert.match(storagePolicyFix, /private\.is_class_member\(classroom\.id\)/);
  assert.match(storagePolicyFix, /for insert to authenticated/);
  assert.match(storagePolicyFix, /private\.is_class_teacher\(classroom\.id\)/);
  assert.match(storagePolicyFix, /owner_id = \(select auth\.uid\(\)::text\)/);
  assert.match(
    storagePolicyFix,
    /classroom\.id::text = \(storage\.foldername\(storage\.objects\.name\)\)\[1\]/,
  );
});

test('assignments preserve task and exam semantics and the dashboard scopes reads', () => {
  assert.match(assignmentKind, /add column if not exists kind text not null default 'task'/);
  assert.match(assignmentKind, /check \(kind in \('task', 'exam'\)\)/);
  assert.doesNotMatch(teacherPortal, /\.in\(['"]classroom_id['"], ids\)/);
  assert.match(teacherPortal, /\.eq\(['"]classroom_id['"], selectedClassId\)/);
  assert.match(teacherPortal, /const taskAssignments = classActivities\.filter/);
  assert.match(teacherPortal, /const examAssignments = classActivities\.filter/);
  assert.match(teacherPortal, /activities=\{taskAssignments\}/);
  assert.match(teacherPortal, /submissions=\{examDelivered\}/);
});

test('attendance keeps an honest offline pending state', () => {
  assert.match(teacherPortal, /pendingSync/);
  assert.match(teacherPortal, /updatedAt/);
  assert.match(teacherPortal, /Há uma chamada salva neste dispositivo aguardando sincronização/);
  assert.match(teacherPortal, /Tentar sincronizar novamente/);
});

test('student summary refreshes after returning to the app', () => {
  assert.match(homePage, /window\.addEventListener\('focus', refreshWhenVisible\)/);
  assert.match(homePage, /document\.addEventListener\('visibilitychange', refreshWhenVisible\)/);
  assert.match(homePage, /window\.removeEventListener\('focus', refreshWhenVisible\)/);
  assert.match(homePage, /document\.removeEventListener\('visibilitychange', refreshWhenVisible\)/);
});

test('production stabilization migrations remain fully versioned', () => {
  assert.match(schemaStabilization, /add column if not exists kind text not null default 'task'/);
  assert.match(schemaStabilization, /add column if not exists image_url text/);
  assert.match(schemaStabilization, /create table if not exists public\.attendance/);
  assert.match(schemaStabilization, /lesson_records_id_classroom_uidx/);
  assert.match(schemaStabilization, /storage\.foldername\(storage\.objects\.name\)/);
  assert.match(lessonMaterialFkFix, /on delete set null \(lesson_record_id\)/);
  assert.match(lessonMaterialFkIndex, /\(lesson_record_id, classroom_id\)[\s\S]*where lesson_record_id is not null/);
  assert.match(hardenedGrants, /revoke all on table[\s\S]*public\.submissions[\s\S]*from anon;/);
  assert.match(hardenedGrants, /revoke all on table[\s\S]*public\.submissions[\s\S]*from authenticated;/);
  assert.match(hardenedGrants, /grant update \(answer, status, submitted_at, updated_at\)\s+on public\.submissions to authenticated/);
  assert.doesNotMatch(hardenedGrants, /grant update \([^)]*(score|feedback)/);
});

test('attendance freezes its snapshot while synchronization is in progress', () => {
  assert.match(teacherPortal, /async function save\(\) \{\s*if \(busy\) return;/);
  assert.match(teacherPortal, /key=\{member\.user_id\}[\s\S]*?disabled=\{busy\}/);
  assert.match(teacherPortal, /onClick=\{\(\) => \{\s*if \(busy\) return;/);
  assert.match(teacherPortal, /present: nextPresence\[student\.user_id\] \?\? true/);
});

test('student connect refreshes and removes focus and visibility listeners', () => {
  assert.match(studentConnect, /window\.addEventListener\('focus', refreshWhenVisible\)/);
  assert.match(studentConnect, /document\.addEventListener\('visibilitychange', refreshWhenVisible\)/);
  assert.match(studentConnect, /window\.removeEventListener\('focus', refreshWhenVisible\)/);
  assert.match(studentConnect, /document\.removeEventListener\('visibilitychange', refreshWhenVisible\)/);
  assert.match(studentConnect, /\}, \[loadStudent, session\]\);/);
});
