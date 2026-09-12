import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local = url && ['localhost', '127.0.0.1'].includes(new URL(url).hostname);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const ok = (r) => { assert.ifError(r.error); return r.data; };

test('Phases 1 and 2 finalization: real operations and authorization', async (t) => {
  if (!local || !anon || !serviceKey) { t.skip('Requires disposable local Supabase'); return; }
  const service = createClient(url, serviceKey, opts);
  const suffix = randomUUID().slice(0, 8);
  const password = `Local-only-${suffix}-!Aa12345`;
  const ids = {}, clients = {}, emails = {};
  for (const role of ['admin','otherAdmin','manager','otherManager','teacher','reviewer','approver','student','otherStudent']) {
    emails[role] = `f12-${role.toLowerCase()}-${suffix}@example.test`;
    ids[role] = ok(await service.auth.admin.createUser({ email: emails[role], password, email_confirm: true, user_metadata: { display_name: `DEMO ${role}` } })).user.id;
    clients[role] = createClient(url, anon, opts);
    ok(await clients[role].auth.signInWithPassword({ email: emails[role], password }));
  }
  for (const role of ['admin','otherAdmin']) ok(await service.from('profiles').update({ role: 'network_admin' }).eq('id',ids[role]));
  const network = ok(await service.from('networks').insert({ name: `DEMO network ${suffix}`, created_by: ids.admin }).select().single());
  const otherNetwork = ok(await service.from('networks').insert({ name: `DEMO other ${suffix}`, created_by: ids.otherAdmin }).select().single());
  const school = ok(await service.from('schools').insert({ network_id: network.id,name:'DEMO Escola A',code:'A' }).select().single());
  const schoolB = ok(await service.from('schools').insert({ network_id: network.id,name:'DEMO Escola B',code:'B' }).select().single());
  const year = ok(await service.from('academic_years').insert({ network_id:network.id,label:'DEMO 2026',starts_on:'2026-01-01',ends_on:'2026-12-31',status:'open' }).select().single());
  const nextYear = ok(await service.from('academic_years').insert({ network_id:network.id,label:'DEMO 2027',starts_on:'2027-01-01',ends_on:'2027-12-31',status:'planned' }).select().single());
  const grade = ok(await service.from('school_years').insert({ school_id:school.id,name:'6º ano',code:'6EF' }).select().single());
  for (const role of ['manager','otherManager','teacher','reviewer','approver','student']) ok(await clients.admin.rpc('set_institutional_membership',{target_network:network.id,target_school:role==='otherManager'?schoolB.id:school.id,target_email:emails[role],target_role:role==='otherManager'?'manager':role}));
  const room = ok(await service.from('classrooms').insert({owner_id:ids.teacher,name:'DEMO 6A',subject:'Matemática',network_id:network.id,school_id:school.id,academic_year_id:year.id,school_year_id:grade.id}).select().single());
  const destination = ok(await service.from('classrooms').insert({owner_id:ids.teacher,name:'DEMO 7A',subject:'Matemática',network_id:network.id,school_id:school.id,academic_year_id:nextYear.id,school_year_id:grade.id}).select().single());
  const row = {nome:'DEMO estudante',email:emails.student,identificador:`S-${suffix}`,rede:network.id,escola:school.id,ano_letivo:year.id,serie:grade.id,turma:room.id,action:'CREATE'};
  const importArgs = {target_network:network.id,target_school:school.id,import_rows:[row]};
  let enrollment;
  await t.test('preview writes nothing, validates rows and duplicates, commits idempotently',async()=>{
    const bad = {...row,email:'invalid'};
    const preview = ok(await clients.manager.rpc('preview_student_import',{...importArgs,import_rows:[row,bad,row]}));
    assert.equal(preview.valid,1); assert.equal(preview.invalid,2);
    assert.equal(ok(await service.from('student_enrollments').select('id').eq('network_id',network.id)).length,0);
    const args = {...importArgs,job_id:randomUUID(),file_name:'DEMO.csv',import_rows:[row,bad]};
    const report = ok(await clients.manager.rpc('commit_student_import',args)); assert.equal(report.processed,1);
    assert.deepEqual(ok(await clients.manager.rpc('commit_student_import',args)),report);
    assert.ok((await clients.manager.rpc('commit_student_import',{...args,import_rows:[row]})).error);
    enrollment=report.rows[0].enrollment_id;
    assert.equal(ok(await clients.manager.rpc('preview_student_import',importArgs)).invalid,1);
    const update={...row,action:'UPDATE'};
    assert.equal(ok(await clients.manager.rpc('commit_student_import',{...args,job_id:randomUUID(),import_rows:[update]})).processed,1);
    assert.equal(ok(await clients.manager.rpc('commit_student_import',{...args,job_id:randomUUID(),import_rows:[{...row,action:'SKIP'}]})).processed,0);
    const conflict={...row,email:emails.otherStudent,action:'CREATE'};
    assert.equal(ok(await clients.manager.rpc('preview_student_import',{...importArgs,import_rows:[conflict]})).invalid,1);
  });
  await t.test('negative RBAC, school and network isolation, no public administrative RPC',async()=>{
    for(const role of ['teacher','reviewer','approver','student','otherManager']) assert.ok((await clients[role].rpc('preview_student_import',importArgs)).error,role);
    for(const role of ['teacher','reviewer','approver','student']) assert.ok((await clients[role].rpc('set_institutional_membership',{target_network:network.id,target_school:school.id,target_email:emails[role],target_role:'manager'})).error,role);
    assert.equal(ok(await clients.otherAdmin.from('networks').select('id').eq('id',network.id)).length,0);
    assert.equal(ok(await clients.manager.from('schools').select('id').eq('id',schoolB.id)).length,0);
    assert.ok((await clients.manager.rpc('institutional_user_directory',{target_network:otherNetwork.id})).error);
    assert.ok((await createClient(url,anon,opts).rpc('commit_student_import',{...importArgs,job_id:randomUUID(),file_name:'attack.csv'})).error);
    assert.equal(ok(await clients.manager.rpc('find_profile_for_institution',{target_network:network.id,target_school:school.id,target_email:emails.otherAdmin})).length,0);
  });
  await t.test('promotion previews, preserves historical enrollment, exports and repeats safely',async()=>{
    const args={job_id:randomUUID(),source_classroom:room.id,target_classroom:destination.id,enrollment_ids:[enrollment]};
    assert.equal(ok(await clients.manager.rpc('promote_students',args)).processed,0);
    assert.equal(ok(await service.from('student_enrollments').select('status').eq('id',enrollment).single()).status,'enrolled');
    const report=ok(await clients.manager.rpc('promote_students',{...args,confirm_write:true}));assert.equal(report.processed,1);
    assert.deepEqual(ok(await clients.manager.rpc('promote_students',{...args,confirm_write:true})),report);
    assert.equal(ok(await service.from('student_enrollments').select('status').eq('id',enrollment).single()).status,'completed');
    assert.equal(ok(await clients.manager.from('student_movements').select('movement_type').eq('enrollment_id',enrollment))[0].movement_type,'promotion');
    const rows=ok(await clients.manager.rpc('enrollment_directory',{target_network:network.id,filters:{year:nextYear.id,school:school.id,status:'enrolled'}})); assert.equal(rows.length,1);assert.equal(rows[0].email,emails.student);assert.equal(rows[0].identificador,row.identificador);
    assert.ok((await clients.manager.rpc('promote_students',{...args,job_id:randomUUID(),confirm_write:true})).error);
  });
  await t.test('invitation lifecycle, acceptance, expiration, revocation, directory and history',async()=>{
    const args={target_network:network.id,target_school:school.id,target_email:emails.otherStudent,target_role:'student'};
    const invitation=ok(await clients.manager.rpc('manage_institutional_invitation',args));
    assert.ok((await clients.student.rpc('accept_institutional_invitation',{invitation_id:invitation.id})).error);
    ok(await clients.otherStudent.rpc('accept_institutional_invitation',{invitation_id:invitation.id}));
    const member=ok(await service.from('institutional_memberships').select('id').eq('user_id',ids.otherStudent).eq('network_id',network.id).single());
    ok(await clients.manager.rpc('set_institutional_membership_status',{target_membership:member.id,target_status:'inactive'}));
    assert.equal(ok(await clients.otherStudent.from('networks').select('id').eq('id',network.id)).length,0);
    ok(await clients.manager.rpc('set_institutional_membership_status',{target_membership:member.id,target_status:'active'}));
    assert.ok(ok(await clients.manager.rpc('institutional_access_history',{target_network:network.id,target_membership:member.id})).length>=3);
    const revoked=ok(await clients.manager.rpc('manage_institutional_invitation',args));
    ok(await clients.manager.rpc('manage_institutional_invitation',{...args,target_action:'revoke',invitation_id:revoked.id}));
    assert.ok((await clients.otherStudent.rpc('accept_institutional_invitation',{invitation_id:revoked.id})).error);
    const expired=ok(await clients.manager.rpc('manage_institutional_invitation',args));
    ok(await service.from('institutional_invitations').update({expires_at:'2020-01-01'}).eq('id',expired.id));
    assert.ok((await clients.otherStudent.rpc('accept_institutional_invitation',{invitation_id:expired.id})).error);
    const directory=ok(await clients.manager.rpc('institutional_user_directory',{target_network:network.id,filters:{role:'student',status:'active',school:school.id},page_size:1}));assert.equal(directory.length,1);assert.equal(directory[0].total_count,2);
  });
  const curriculum=ok(await clients.manager.from('curricula').insert({network_id:network.id,name:'DEMO Curriculum',curriculum_type:'custom',version:'1',created_by:ids.manager}).select().single());
  const curricularRow={area:'DEMO Matemática',componente:'DEMO Matemática',ano_codigo:'6EF',ano:'6º ano',unidade:'DEMO Números',objeto:'DEMO Frações',codigo:'DEMO-001',descricao:'Habilidade estritamente demonstrativa.',action:'CREATE'};
  const curricularArgs={job_id:randomUUID(),target_network:network.id,target_curriculum:curriculum.id,file_name:'DEMO.json',import_rows:[curricularRow]};
  await t.test('curriculum import is atomic, idempotent and respects natural identity',async()=>{
    assert.equal(ok(await clients.manager.rpc('import_curriculum_rows',curricularArgs)).invalid,0);
    assert.equal(ok(await service.from('curriculum_skills').select('id').eq('curriculum_id',curriculum.id)).length,0);
    const report=ok(await clients.manager.rpc('import_curriculum_rows',{...curricularArgs,confirm_write:true}));assert.equal(report.created,1);
    assert.deepEqual(ok(await clients.manager.rpc('import_curriculum_rows',{...curricularArgs,confirm_write:true})),report);
    assert.equal(ok(await clients.manager.rpc('import_curriculum_rows',{...curricularArgs,job_id:randomUUID()})).invalid,1);
    const update={...curricularRow,action:'UPDATE',descricao:'Descrição demonstrativa atualizada.'};
    assert.equal(ok(await clients.manager.rpc('import_curriculum_rows',{...curricularArgs,job_id:randomUUID(),import_rows:[update],confirm_write:true})).updated,1);
    assert.ok((await clients.manager.rpc('import_curriculum_rows',{...curricularArgs,job_id:randomUUID(),import_rows:[{...curricularRow,codigo:'DEMO-002'},{...curricularRow,codigo:'DEMO-003',area:''}],confirm_write:true})).error);
    assert.equal(ok(await service.from('curriculum_skills').select('id').eq('curriculum_id',curriculum.id)).length,1);
    assert.ok((await clients.teacher.rpc('import_curriculum_rows',curricularArgs)).error);
    assert.ok((await clients.otherAdmin.rpc('import_curriculum_rows',curricularArgs)).error);
  });
  const skill=ok(await service.from('curriculum_skills').select('*').eq('curriculum_id',curriculum.id).single());
  const payload={curriculum_id:curriculum.id,subject_id:skill.subject_id,curriculum_school_year_id:skill.curriculum_school_year_id,skill_id:skill.id,internal_title:'DEMO questão',statement:'Qual alternativa corresponde ao exemplo?',pedagogical_comment:'Comentário pedagógico DEMO.',correct_answer_justification:'A resposta A corresponde ao exemplo DEMO.',difficulty:'medium',item_type:'multiple_choice',formula:'\\frac{1}{2}'};
  const options=Array.from({length:4},(_,i)=>({content:`DEMO alternativa ${i+1}`,is_correct:i===0,distractor_analysis:i===0?null:'Análise pedagógica DEMO do erro.'}));
  let item;
  await t.test('atomic item editor requires four options, one answer and complete pedagogy',async()=>{
    for(const wrong of [options.slice(0,3),[...options,options[1]],options.map(o=>({...o,is_correct:true})),options.map(o=>({...o,distractor_analysis:''}))]) assert.ok((await clients.teacher.rpc('save_assessment_item',{target_network:network.id,payload,item_options:wrong})).error);
    assert.equal(ok(await service.from('assessment_items').select('id').eq('network_id',network.id)).length,0);
    item=ok(await clients.teacher.rpc('save_assessment_item',{target_network:network.id,payload,item_options:options}));
    assert.ok((await clients.student.rpc('save_assessment_item',{target_network:network.id,payload,item_options:options})).error);
  });
  let imagePath;
  await t.test('private images validate MIME, path, permissions and size',async()=>{
    imagePath=`${network.id}/${item}/${randomUUID()}.png`;
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
    ok(await clients.teacher.storage.from('assessment-item-images').upload(imagePath,png,{contentType:'image/png'}));
    ok(await clients.teacher.rpc('set_item_images',{target_item:item,paths:[imagePath]}));
    assert.ok((await clients.otherAdmin.storage.from('assessment-item-images').download(imagePath)).error);
    assert.ok((await clients.teacher.storage.from('assessment-item-images').upload(`${network.id}/${item}/${randomUUID()}.svg`,'<svg/>',{contentType:'image/svg+xml'})).error);
    assert.ok((await clients.teacher.storage.from('assessment-item-images').upload(`${network.id}/${item}/${randomUUID()}.png`,Buffer.alloc(5242881),{contentType:'image/png'})).error);
  });
  await t.test('editorial reasons, version snapshots and revision drafts preserve approvals',async()=>{
    ok(await clients.teacher.rpc('transition_assessment_item',{target_item:item,target_action:'submit',action_comment:'Autor: pronto para revisão'}));
    assert.ok((await clients.reviewer.rpc('transition_assessment_item',{target_item:item,target_action:'return'})).error);
    ok(await clients.reviewer.rpc('transition_assessment_item',{target_item:item,target_action:'return',action_comment:'Revise a redação do enunciado'}));
    ok(await clients.teacher.rpc('transition_assessment_item',{target_item:item,target_action:'submit'}));
    ok(await clients.reviewer.rpc('transition_assessment_item',{target_item:item,target_action:'review',action_comment:'Revisão concluída'}));
    assert.ok((await clients.approver.rpc('transition_assessment_item',{target_item:item,target_action:'reject'})).error);
    ok(await clients.approver.rpc('transition_assessment_item',{target_item:item,target_action:'approve',action_comment:'Aprovado pedagogicamente'}));
    const snapshots=ok(await clients.teacher.from('assessment_item_versions').select('*').eq('item_id',item).order('version_number'));
    assert.equal(snapshots.length,5); assert.ok(snapshots.at(-1).snapshot.image_paths.includes(imagePath));
    assert.ok((await clients.teacher.rpc('save_assessment_item',{target_network:network.id,target_item:item,payload,item_options:options})).error);
    const revision=ok(await clients.teacher.rpc('revise_assessment_item',{target_item:item}));assert.notEqual(revision,item);
    ok(await clients.teacher.rpc('save_assessment_item',{target_network:network.id,target_item:revision,payload:{...payload,statement:'Enunciado revisado para o exemplo.'},item_options:options}));
    assert.deepEqual(ok(await clients.teacher.from('assessment_item_versions').select('*').eq('item_id',item).order('version_number')),snapshots);
    await clients.teacher.storage.from('assessment-item-images').remove([imagePath]);
    assert.ifError((await clients.teacher.storage.from('assessment-item-images').download(imagePath)).error);
  });
  await t.test('1500+ DEMO rows paginate on server; coverage and readiness use real counts',async()=>{
    for(let n=0;n<1500;n+=100) ok(await service.from('assessment_items').insert(Array.from({length:100},(_,j)=>({...payload,network_id:network.id,author_id:ids.teacher,internal_title:`DEMO escala ${n+j}`,item_type:'essay'}))));
    const args={target_network:network.id,filters:{curriculum:curriculum.id,type:'essay',difficulty:'medium',author:ids.teacher},page_size:25};
    const first=ok(await clients.teacher.rpc('item_bank_directory',args));const second=ok(await clients.teacher.rpc('item_bank_directory',{...args,page_offset:25}));
    assert.equal(first.length,25);assert.equal(first[0].total_count,1500);assert.ok(!first.some(x=>second.some(y=>x.item_id===y.item_id)));
    assert.ok((await clients.otherAdmin.rpc('item_bank_directory',args)).error);
    const coverage=ok(await clients.teacher.rpc('item_bank_coverage',{target_network:network.id,target_curriculum:curriculum.id}));assert.equal(coverage.totals.total,1502);assert.equal(coverage.totals.approved,1);
    assert.equal(ok(await clients.teacher.rpc('item_content_readiness',{target_network:network.id,target_subject:skill.subject_id,target_year:skill.curriculum_school_year_id,minimum_items:5})).ready,false);
  });
  // Disposable runner database: fixtures are explicitly DEMO and disappear with supabase stop --no-backup.
});
