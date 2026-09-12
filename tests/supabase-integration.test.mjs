import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isLocalSupabase(target) {
  if (!target) return false;
  try {
    return ['127.0.0.1', 'localhost'].includes(new URL(target).hostname);
  } catch {
    return false;
  }
}

async function signedInClient(email, password) {
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  assert.ok(data.session?.access_token);
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    },
  });
}

test('RLS and grants isolate classes on a local Supabase instance', async (t) => {
  if (!isLocalSupabase(url) || !anonKey || !serviceRoleKey) {
    t.skip('Set local SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.');
    return;
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = `Local-only-${suffix}!`;
  const identities = {
    teacherA: 'ribeiroleonardoti@gmail.com',
    teacherB: `teacher-b-${suffix}@example.test`,
    studentA: `student-a-${suffix}@example.test`,
    studentB: `student-b-${suffix}@example.test`,
    outsider: `outsider-${suffix}@example.test`,
  };
  const userIds = [];
  const storagePaths = [];

  t.after(async () => {
    if (storagePaths.length) {
      await admin.storage.from('lesson-materials').remove(storagePaths);
    }
    for (const id of userIds.reverse()) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  const created = {};
  for (const [role, email] of Object.entries(identities)) {
    const result = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: role },
    });
    assert.ifError(result.error);
    created[role] = result.data.user.id;
    userIds.push(result.data.user.id);
  }

  const teacherProfile = await admin
    .from('profiles')
    .select('role')
    .eq('id', created.teacherA)
    .single();
  assert.ifError(teacherProfile.error);
  assert.equal(teacherProfile.data.role, 'teacher');

  const [teacherA, studentA, studentB] = await Promise.all([
    signedInClient(identities.teacherA, password),
    signedInClient(identities.studentA, password),
    signedInClient(identities.studentB, password),
  ]);

  const classA = {
    id: randomUUID(),
    join_code: randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase(),
  };
  const classAResult = await teacherA
    .from('classrooms')
    .insert({ ...classA, owner_id: created.teacherA, name: 'Turma A', subject: 'Português' });
  assert.ifError(classAResult.error);
  const classBResult = await admin
    .from('classrooms')
    .insert({ owner_id: created.teacherB, name: 'Turma B', subject: 'Matemática' })
    .select('id,join_code')
    .single();
  assert.ifError(classBResult.error);
  const classB = classBResult.data;

  assert.ifError((await studentA.rpc('join_class_by_code', { code: classA.join_code })).error);
  assert.ifError((await studentB.rpc('join_class_by_code', { code: classB.join_code })).error);

  const ownClass = await studentA.from('classrooms').select('id').eq('id', classA.id);
  assert.ifError(ownClass.error);
  assert.equal(ownClass.data.length, 1);
  const otherClass = await studentA.from('classrooms').select('id').eq('id', classB.id);
  assert.ifError(otherClass.error);
  assert.equal(otherClass.data.length, 0);

  const assignmentAResult = await teacherA
    .from('assignments')
    .insert({ classroom_id: classA.id, created_by: created.teacherA, title: 'Tarefa A', subject: 'Português', points: 10 })
    .select('id')
    .single();
  assert.ifError(assignmentAResult.error);
  const assignmentBResult = await admin
    .from('assignments')
    .insert({ classroom_id: classB.id, created_by: created.teacherB, title: 'Tarefa B', subject: 'Matemática', points: 10 })
    .select('id')
    .single();
  assert.ifError(assignmentBResult.error);

  const materialAResult = await teacherA
    .from('lesson_materials')
    .insert({ classroom_id: classA.id, teacher_id: created.teacherA, title: 'Material A', file_name: 'a.txt', storage_path: `${classA.id}/${suffix}-a.txt`, file_type: 'text/plain', file_size: 1 })
    .select('id')
    .single();
  assert.ifError(materialAResult.error);
  const materialBResult = await admin
    .from('lesson_materials')
    .insert({ classroom_id: classB.id, teacher_id: created.teacherB, title: 'Material B', file_name: 'b.txt', storage_path: `${classB.id}/${suffix}-b.txt`, file_type: 'text/plain', file_size: 1 })
    .select('id')
    .single();
  assert.ifError(materialBResult.error);

  const ownMaterial = await studentA.from('lesson_materials').select('id').eq('id', materialAResult.data.id);
  assert.ifError(ownMaterial.error);
  assert.equal(ownMaterial.data.length, 1);
  const otherMaterial = await studentA.from('lesson_materials').select('id').eq('id', materialBResult.data.id);
  assert.ifError(otherMaterial.error);
  assert.equal(otherMaterial.data.length, 0);

  const studentUpload = await studentA.storage.from('lesson-materials').upload(`${classA.id}/${suffix}-student.txt`, new Blob(['x'], { type: 'text/plain' }));
  assert.ok(studentUpload.error, 'student upload must be rejected');
  const ownPath = `${classA.id}/${suffix}-teacher.txt`;
  const teacherUpload = await teacherA.storage.from('lesson-materials').upload(ownPath, new Blob(['x'], { type: 'text/plain' }));
  assert.ifError(teacherUpload.error);
  storagePaths.push(ownPath);
  const foreignUpload = await teacherA.storage.from('lesson-materials').upload(`${classB.id}/${suffix}-foreign.txt`, new Blob(['x'], { type: 'text/plain' }));
  assert.ok(foreignUpload.error, 'teacher upload to another class must be rejected');
  const teacherDelete = await teacherA.storage.from('lesson-materials').remove([ownPath]);
  assert.ifError(teacherDelete.error);
  storagePaths.splice(storagePaths.indexOf(ownPath), 1);

  const draftResult = await studentA
    .from('submissions')
    .insert({ assignment_id: assignmentAResult.data.id, student_id: created.studentA, answer: 'rascunho', status: 'draft' })
    .select('id')
    .single();
  assert.ifError(draftResult.error);
  const submitted = await studentA
    .from('submissions')
    .update({ answer: 'resposta final', status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', draftResult.data.id);
  assert.ifError(submitted.error);
  assert.ok((await studentA.from('submissions').update({ score: 10 }).eq('id', draftResult.data.id)).error);
  assert.ok((await studentA.from('submissions').update({ feedback: 'alterado' }).eq('id', draftResult.data.id)).error);
  assert.ifError((await teacherA.rpc('grade_submission', { target_submission: draftResult.data.id, new_score: 9, new_feedback: 'Bom trabalho' })).error);

  const foreignSubmission = await admin
    .from('submissions')
    .insert({ assignment_id: assignmentBResult.data.id, student_id: created.studentB, answer: 'B', status: 'submitted', submitted_at: new Date().toISOString() })
    .select('id')
    .single();
  assert.ifError(foreignSubmission.error);
  assert.ok((await teacherA.rpc('grade_submission', { target_submission: foreignSubmission.data.id, new_score: 8, new_feedback: 'inválido' })).error);

  const memberAttendance = await teacherA.from('attendance').insert({
    classroom_id: classA.id,
    student_id: created.studentA,
    attendance_date: '2026-09-12',
    present: true,
    recorded_by: created.teacherA,
  });
  assert.ifError(memberAttendance.error);
  const outsiderAttendance = await teacherA.from('attendance').insert({
    classroom_id: classA.id,
    student_id: created.outsider,
    attendance_date: '2026-09-12',
    present: true,
    recorded_by: created.teacherA,
  });
  assert.ok(outsiderAttendance.error, 'attendance for a non-member must be rejected');
});
