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
const institutionalFoundation = readMigration(
  '20260912153902_add_institutional_rbac_foundation.sql',
);
const institutionalOperations = readMigration(
  '20260912171627_finalize_phase_1_operations.sql',
);
const phase2Foundation = readMigration(
  '20260912173208_add_curriculum_and_item_bank_foundation.sql',
);
const studentConnect = readFileSync(
  new URL('../components/student-connect.tsx', import.meta.url),
  'utf8',
);
const teacherPortal = readFileSync(
  new URL('../components/teacher-portal.tsx', import.meta.url),
  'utf8',
);
const institutionalAdmin = readFileSync(
  new URL('../components/institutional-admin.tsx', import.meta.url),
  'utf8',
);
const institutionalPedagogy = readFileSync(
  new URL('../components/institutional-pedagogy.tsx', import.meta.url),
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

test('institutional foundation is additive and protects scoped RBAC data', () => {
  for (const table of [
    'networks',
    'schools',
    'academic_years',
    'school_years',
    'institutional_memberships',
    'student_enrollments',
    'student_movements',
  ]) {
    assert.match(
      institutionalFoundation,
      new RegExp(`create table if not exists public\\.${table}`),
    );
    assert.match(
      institutionalFoundation,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
  }
  for (const role of ['network_admin', 'manager', 'reviewer', 'approver']) {
    assert.match(
      institutionalFoundation,
      new RegExp(`alter type public\\.app_role add value if not exists '${role}'`),
    );
  }
  assert.match(institutionalFoundation, /create or replace function private\.has_permission/);
  assert.match(institutionalFoundation, /profile\.role::text = 'network_admin'/);
  assert.match(institutionalFoundation, /institutional_memberships_network_role_ux/);
  assert.match(institutionalFoundation, /create policy student_enrollments_read/);
  assert.match(institutionalFoundation, /create policy student_movements_manage/);
  assert.match(institutionalFoundation, /add column if not exists network_id/);
  assert.match(institutionalFoundation, /add column if not exists school_id/);
  assert.doesNotMatch(institutionalFoundation, /drop table public\./i);
  assert.doesNotMatch(institutionalFoundation, /drop column/i);
  assert.doesNotMatch(institutionalFoundation, /revoke all on all functions in schema private/i);
});

test('institutional roles enter a real scoped administration interface', () => {
  assert.match(teacherPortal, /isInstitutionalRole\(profile\.role\)/);
  assert.match(teacherPortal, /<InstitutionalAdmin/);
  for (const table of ['networks', 'schools', 'academic_years', 'school_years']) {
    assert.match(institutionalAdmin, new RegExp(`supabase\\.from\\('${table}'\\)`));
  }
  assert.match(institutionalAdmin, /profile\.role === 'network_admin'/);
  assert.match(institutionalAdmin, /profile\.role === 'manager'/);
  assert.doesNotMatch(institutionalAdmin, /service_role|serviceRole/i);
});

test('Phase 1 mutations use guarded RPCs and preserve movement history', () => {
  for (const rpc of [
    'set_institutional_membership',
    'set_institutional_membership_status',
    'link_classroom_to_institution',
    'set_institutional_classroom_status',
    'create_student_enrollment',
    'transition_student_enrollment',
  ]) assert.match(institutionalOperations, new RegExp(`function public\\.${rpc}`));
  assert.match(institutionalOperations, /private\.can_assign_institutional_role/);
  assert.match(institutionalOperations, /Responsible teacher must be linked to school/);
  assert.match(institutionalOperations, /insert into public\.student_movements/);
  assert.match(institutionalOperations, /revoke update on public\.classrooms from authenticated/);
  assert.match(institutionalOperations, /classrooms_complete_institutional_scope_check/);
  assert.doesNotMatch(institutionalOperations, /service_role|serviceRole/i);
});

test('Phase 2 separates curricula, item workflow and immutable versions', () => {
  for (const table of [
    'curricula', 'curriculum_areas', 'curriculum_subjects',
    'curriculum_school_years', 'curriculum_thematic_units',
    'curriculum_knowledge_objects', 'curriculum_skills',
    'assessment_items', 'assessment_item_options',
    'assessment_item_versions', 'assessment_item_reviews', 'audit_logs',
  ]) {
    assert.match(phase2Foundation, new RegExp(`create table public\\.${table}`));
    assert.match(phase2Foundation, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(phase2Foundation, /function public\.transition_assessment_item/);
  assert.match(phase2Foundation, /Multiple choice item requires at least four options/);
  assert.match(phase2Foundation, /Multiple choice item requires exactly one correct option/);
  assert.match(phase2Foundation, /insert into public\.assessment_item_versions/);
  assert.match(phase2Foundation, /create or replace view public\.approved_assessment_items/);
  assert.match(phase2Foundation, /limit least\(greatest\(page_size, 1\), 100\)/);
  assert.match(phase2Foundation, /curriculum_type = 'custom'/);
  assert.doesNotMatch(phase2Foundation, /service_role|serviceRole/i);
});

test('institutional UI exposes curriculum, safe authorship and paginated workflow', () => {
  assert.match(institutionalAdmin, /<InstitutionalPedagogy/);
  assert.match(institutionalPedagogy, /BNCC\/SAEB são referências protegidas/);
  assert.match(institutionalPedagogy, /CSV ou JSON com prévia obrigatória/);
  assert.match(institutionalPedagogy, /katex\.renderToString/);
  assert.match(institutionalPedagogy, /trust: false/);
  assert.match(institutionalPedagogy, /page_size: 20/);
  assert.match(institutionalPedagogy, /transition_assessment_item/);
  assert.match(institutionalPedagogy, /Habilidades sem itens/);
  assert.doesNotMatch(institutionalPedagogy, /service_role|serviceRole/i);
});

test('official PoC traceability matrix records source pages and honest statuses', () => {
  const matrix = readFileSync(
    new URL('../docs/licitacao-pregao-40-2026.md', import.meta.url),
    'utf8',
  );
  assert.match(matrix, /Matriz de conformidade - Pregão Eletrônico nº 40\/2026/);
  assert.match(matrix, /Checklist rastreável da PoC oficial/);
  assert.match(matrix, /1\.1[\s\S]*67–68/);
  assert.match(matrix, /1\.17[\s\S]*76/);
  assert.match(matrix, /2\.3[\s\S]*77/);
  assert.match(matrix, /DEPENDÊNCIA DE OPERAÇÃO EXTERNA/);
});
