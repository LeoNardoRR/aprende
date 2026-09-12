'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive, BookOpenCheck, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert,
  ClipboardCheck, FileSearch, Filter, LibraryBig, LoaderCircle, Plus, Search,
  Send, ShieldCheck, Upload, XCircle,
} from 'lucide-react';
import katex from 'katex';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import type { InstitutionalProfile } from '@/components/institutional-admin';

type NetworkRow = Tables<'networks'>;
type Curriculum = Tables<'curricula'>;
type Area = Tables<'curriculum_areas'>;
type Subject = Tables<'curriculum_subjects'>;
type CurriculumYear = Tables<'curriculum_school_years'>;
type Unit = Tables<'curriculum_thematic_units'>;
type KnowledgeObject = Tables<'curriculum_knowledge_objects'>;
type Skill = Tables<'curriculum_skills'>;
type ItemListRow = Awaited<ReturnType<typeof listItemsType>>[number];
type PedagogyView = 'curricula' | 'items' | 'mine' | 'reviews' | 'approvals';

const statusLabels: Record<string, string> = {
  draft: 'Rascunho', in_review: 'Em revisão', reviewed: 'Revisado', approved: 'Aprovado',
  rejected: 'Devolvido', archived: 'Arquivado',
};

const previewCurricula: Curriculum[] = [
  { id: 'curriculum-bncc', network_id: null, name: 'BNCC', curriculum_type: 'bncc', version: 'Referência oficial', active: true, created_by: null, created_at: '2026-09-12T12:00:00Z', updated_at: '2026-09-12T12:00:00Z' },
  { id: 'curriculum-custom', network_id: 'network-preview', name: 'Currículo Municipal - DEMO', curriculum_type: 'custom', version: '1.0', active: true, created_by: 'preview-admin', created_at: '2026-09-12T12:00:00Z', updated_at: '2026-09-12T12:00:00Z' },
];

const previewItems: ItemListRow[] = [
  { item_id: 'item-demo-1', internal_title: 'DEMO - Frações equivalentes', statement: 'Qual fração é equivalente a 1/2?', item_type: 'multiple_choice', difficulty: 'medium', item_status: 'in_review', curriculum_name: 'Currículo Municipal - DEMO', subject_name: 'Matemática', school_year_name: '6º ano', skill_code: 'DEMO-EF06MA07', author_name: 'Professor Gabriel', reviewer_name: null, approver_name: null, current_version: 1, updated_at: '2026-09-12T12:00:00Z', total_count: 2 },
  { item_id: 'item-demo-2', internal_title: 'DEMO - Leitura e inferência', statement: 'Leia o trecho e identifique a informação implícita.', item_type: 'essay', difficulty: 'medium', item_status: 'approved', curriculum_name: 'Currículo Municipal - DEMO', subject_name: 'Língua Portuguesa', school_year_name: '6º ano', skill_code: 'DEMO-EF67LP04', author_name: 'Professora Ana', reviewer_name: 'Revisão pedagógica', approver_name: 'Gestão pedagógica', current_version: 3, updated_at: '2026-09-11T12:00:00Z', total_count: 2 },
];

function listItemsType() {
  return Promise.resolve([] as {
    item_id: string; internal_title: string; statement: string; item_type: string;
    difficulty: string; item_status: string; curriculum_name: string; subject_name: string;
    school_year_name: string; skill_code: string; author_name: string;
    reviewer_name: string | null; approver_name: string | null; current_version: number;
    updated_at: string; total_count: number;
  }[]);
}

export function InstitutionalPedagogy({
  profile, networks, preview = false,
}: { profile: InstitutionalProfile; networks: NetworkRow[]; preview?: boolean }) {
  const [view, setView] = useState<PedagogyView>('curricula');
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? '');
  const [curricula, setCurricula] = useState<Curriculum[]>(preview ? previewCurricula : []);
  const [areas, setAreas] = useState<Area[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [years, setYears] = useState<CurriculumYear[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [objects, setObjects] = useState<KnowledgeObject[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [items, setItems] = useState<ItemListRow[]>(preview ? previewItems : []);
  const [selectedCurriculum, setSelectedCurriculum] = useState(preview ? previewCurricula[0].id : '');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(!preview);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [showCurriculumForm, setShowCurriculumForm] = useState(false);
  const [showStructureForm, setShowStructureForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [importPreview, setImportPreview] = useState<{ name: string; rows: string[][]; errors: string[] } | null>(null);

  useEffect(() => {
    if (!networkId && networks[0]?.id) setNetworkId(networks[0].id);
  }, [networkId, networks]);

  useEffect(() => {
    const followHash = () => {
      if (window.location.hash === '#item-bank') setView('items');
      if (window.location.hash === '#curricula') setView('curricula');
    };
    followHash();
    window.addEventListener('hashchange', followHash);
    return () => window.removeEventListener('hashchange', followHash);
  }, []);

  const loadCurricula = useCallback(async () => {
    if (preview || !networkId) return;
    setLoading(true);
    const result = await supabase.from('curricula').select('*').or(`network_id.is.null,network_id.eq.${networkId}`).order('name');
    if (result.error) setNotice(`Não foi possível carregar os currículos: ${result.error.message}`);
    else {
      setCurricula(result.data ?? []);
      setSelectedCurriculum((current) => current || result.data?.[0]?.id || '');
    }
    setLoading(false);
  }, [networkId, preview]);

  const loadStructure = useCallback(async () => {
    if (preview || !selectedCurriculum) return;
    const [areaResult, subjectResult, yearResult, unitResult, objectResult, skillResult] = await Promise.all([
      supabase.from('curriculum_areas').select('*').eq('curriculum_id', selectedCurriculum).order('sort_order'),
      supabase.from('curriculum_subjects').select('*').eq('curriculum_id', selectedCurriculum).order('sort_order'),
      supabase.from('curriculum_school_years').select('*').eq('curriculum_id', selectedCurriculum).order('sort_order'),
      supabase.from('curriculum_thematic_units').select('*').eq('curriculum_id', selectedCurriculum).order('sort_order'),
      supabase.from('curriculum_knowledge_objects').select('*').eq('curriculum_id', selectedCurriculum).order('sort_order'),
      supabase.from('curriculum_skills').select('*').eq('curriculum_id', selectedCurriculum).order('code'),
    ]);
    const error = [areaResult, subjectResult, yearResult, unitResult, objectResult, skillResult].find((result) => result.error)?.error;
    if (error) setNotice(`Não foi possível carregar a estrutura: ${error.message}`);
    setAreas(areaResult.data ?? []); setSubjects(subjectResult.data ?? []); setYears(yearResult.data ?? []);
    setUnits(unitResult.data ?? []); setObjects(objectResult.data ?? []); setSkills(skillResult.data ?? []);
  }, [preview, selectedCurriculum]);

  const loadItems = useCallback(async () => {
    if (preview || !networkId) return;
    setLoading(true);
    const effectiveStatus = view === 'reviews' ? 'in_review' : view === 'approvals' ? 'reviewed' : statusFilter;
    const result = await supabase.rpc('list_assessment_items', {
      target_network: networkId, status_filter: effectiveStatus, search_query: search,
      author_filter: view === 'mine' ? profile.id : null, page_size: 20, page_offset: page * 20,
    });
    if (result.error) setNotice(`Não foi possível carregar os itens: ${result.error.message}`);
    else setItems(result.data ?? []);
    setLoading(false);
  }, [networkId, page, preview, profile.id, search, statusFilter, view]);

  useEffect(() => { void loadCurricula(); }, [loadCurricula]);
  useEffect(() => { void loadStructure(); }, [loadStructure]);
  useEffect(() => { if (view !== 'curricula') void loadItems(); }, [loadItems, view]);

  const selected = curricula.find((curriculum) => curriculum.id === selectedCurriculum);
  const totalItems = items[0]?.total_count ?? 0;
  const dashboard = useMemo(() => ['draft', 'in_review', 'reviewed', 'approved', 'rejected'].map((status) => ({
    status, count: items.filter((item) => item.item_status === status).length,
  })), [items]);
  const uncoveredSkills = useMemo(() => Math.max(0, skills.length - new Set(items.map((item) => item.skill_code)).size), [items, skills]);

  async function createCurriculum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice('');
    const form = new FormData(event.currentTarget);
    if (preview) {
      setCurricula((current) => [...current, { id: crypto.randomUUID(), network_id: networkId, name: String(form.get('name')), curriculum_type: 'custom', version: String(form.get('version')), active: true, created_by: profile.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
      setNotice('Currículo criado na prévia.');
    } else {
      const result = await supabase.from('curricula').insert({ network_id: networkId, name: String(form.get('name')).trim(), curriculum_type: 'custom', version: String(form.get('version')).trim(), created_by: profile.id }).select('id').single();
      if (result.error) setNotice(`Não foi possível criar: ${result.error.message}`);
      else { setSelectedCurriculum(result.data.id); setNotice('Currículo próprio criado.'); await loadCurricula(); }
    }
    setBusy(false); setShowCurriculumForm(false);
  }

  async function addStructure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice('');
    const form = new FormData(event.currentTarget); const kind = String(form.get('kind')); const name = String(form.get('name')).trim();
    let error: { message: string } | null = null;
    if (!preview) {
      if (kind === 'area') ({ error } = await supabase.from('curriculum_areas').insert({ curriculum_id: selectedCurriculum, name }));
      if (kind === 'subject') ({ error } = await supabase.from('curriculum_subjects').insert({ curriculum_id: selectedCurriculum, area_id: String(form.get('area_id')), name }));
      if (kind === 'year') ({ error } = await supabase.from('curriculum_school_years').insert({ curriculum_id: selectedCurriculum, code: String(form.get('code')).trim(), name }));
      if (kind === 'unit') ({ error } = await supabase.from('curriculum_thematic_units').insert({ curriculum_id: selectedCurriculum, subject_id: String(form.get('subject_id')), curriculum_school_year_id: String(form.get('year_id')), name }));
      if (kind === 'object') ({ error } = await supabase.from('curriculum_knowledge_objects').insert({ curriculum_id: selectedCurriculum, thematic_unit_id: String(form.get('unit_id')), name }));
      if (kind === 'skill') ({ error } = await supabase.from('curriculum_skills').insert({ curriculum_id: selectedCurriculum, subject_id: String(form.get('subject_id')), curriculum_school_year_id: String(form.get('year_id')), thematic_unit_id: String(form.get('unit_id')) || null, knowledge_object_id: String(form.get('object_id')) || null, code: String(form.get('code')).trim().toUpperCase(), description: String(form.get('description')).trim() }));
    }
    setBusy(false);
    if (error) setNotice(`Não foi possível adicionar: ${error.message}`);
    else { setNotice(preview ? 'Estrutura validada na prévia.' : 'Estrutura curricular atualizada.'); setShowStructureForm(false); await loadStructure(); }
  }

  function previewImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'json'].includes(extension ?? '')) { setNotice('Envie um arquivo CSV ou JSON.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const rows = extension === 'json'
          ? (JSON.parse(text) as Record<string, unknown>[]).slice(0, 20).map((row) => Object.values(row).map(String))
          : text.split(/\r?\n/).filter(Boolean).slice(0, 21).map((line) => line.split(',').map((cell) => cell.trim()));
        const errors = rows.length < 2 ? ['O arquivo precisa conter cabeçalho e ao menos uma linha.'] : [];
        setImportPreview({ name: file.name, rows, errors });
      } catch { setImportPreview({ name: file.name, rows: [], errors: ['Arquivo inválido ou malformado.'] }); }
    };
    reader.readAsText(file);
  }

  async function registerImport() {
    if (!importPreview || importPreview.errors.length || !networkId) return;
    setBusy(true);
    if (preview) setNotice('Dry-run concluído na prévia. Nenhum dado oficial foi importado.');
    else {
      const result = await supabase.from('curriculum_imports').insert({
        network_id: networkId, curriculum_id: selectedCurriculum || null,
        file_name: importPreview.name, format: importPreview.name.endsWith('.json') ? 'json' : 'csv',
        status: 'validated', row_count: Math.max(0, importPreview.rows.length - 1),
        valid_count: Math.max(0, importPreview.rows.length - 1), preview_rows: importPreview.rows,
        created_by: profile.id,
      });
      setNotice(result.error ? `Não foi possível registrar o dry-run: ${result.error.message}` : 'Dry-run validado e registrado. Confirmação de importação permanece separada.');
    }
    setBusy(false);
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice('');
    const form = new FormData(event.currentTarget);
    const payload = {
      network_id: networkId, curriculum_id: String(form.get('curriculum_id')),
      curriculum_school_year_id: String(form.get('year_id')), subject_id: String(form.get('subject_id')),
      skill_id: String(form.get('skill_id')), internal_title: String(form.get('title')).trim(),
      statement: String(form.get('statement')).trim(), support_text: String(form.get('support_text')).trim() || null,
      pedagogical_comment: String(form.get('pedagogical_comment')).trim() || null,
      correct_answer_justification: String(form.get('justification')).trim() || null,
      difficulty: String(form.get('difficulty')), item_type: String(form.get('item_type')), author_id: profile.id,
    };
    if (preview) { setNotice('Item DEMO criado na prévia.'); setShowItemForm(false); setBusy(false); return; }
    const item = await supabase.from('assessment_items').insert(payload).select('id').single();
    if (item.error) { setNotice(`Não foi possível criar o item: ${item.error.message}`); setBusy(false); return; }
    if (payload.item_type !== 'essay') {
      const optionCount = payload.item_type === 'true_false' ? 2 : 4;
      const options = Array.from({ length: optionCount }, (_, index) => ({
        item_id: item.data.id, label: String.fromCharCode(65 + index), content: String(form.get(`option_${index}`)).trim(),
        is_correct: Number(form.get('correct_option')) === index, sort_order: index,
        feedback: String(form.get(`feedback_${index}`)).trim() || null,
        distractor_analysis: index === Number(form.get('correct_option')) ? null : String(form.get(`analysis_${index}`)).trim() || null,
      }));
      const optionResult = await supabase.from('assessment_item_options').insert(options);
      if (optionResult.error) { setNotice(`Item criado, mas as alternativas falharam: ${optionResult.error.message}`); setBusy(false); return; }
    }
    setNotice('Item salvo como rascunho.'); setShowItemForm(false); setBusy(false); await loadItems();
  }

  async function transition(itemId: string, action: string) {
    setBusy(true); const comment = window.prompt('Comentário da decisão (opcional):') ?? '';
    if (preview) setItems((current) => current.map((item) => item.item_id === itemId ? { ...item, item_status: action === 'submit' ? 'in_review' : action === 'review' ? 'reviewed' : action === 'approve' ? 'approved' : action === 'archive' ? 'archived' : 'rejected' } : item));
    else {
      const result = await supabase.rpc('transition_assessment_item', { target_item: itemId, target_action: action, action_comment: comment });
      setNotice(result.error ? `A transição foi recusada: ${result.error.message}` : 'Status atualizado e versão preservada.');
      if (!result.error) await loadItems();
    }
    setBusy(false);
  }

  return (
    <section id="curricula" className="institutional-pedagogy">
      <span id="item-bank" className="institutional-anchor" aria-hidden="true" />
      <div className="institutional-panel-head">
        <div><span>GESTÃO PEDAGÓGICA</span><h2>Currículos e Banco de Itens</h2><p>Estrutura curricular, autoria e aprovação com histórico.</p></div>
        <label className="institutional-field compact"><span>Rede</span><select value={networkId} onChange={(event) => setNetworkId(event.target.value)} aria-label="Selecionar rede">{networks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}</select></label>
      </div>

      <nav className="pedagogy-tabs" aria-label="Navegação pedagógica">
        <button className={view === 'curricula' ? 'active' : ''} onClick={() => setView('curricula')}><LibraryBig /> Currículos</button>
        <button className={view === 'items' ? 'active' : ''} onClick={() => setView('items')}><BookOpenCheck /> Banco de Itens</button>
        <button className={view === 'mine' ? 'active' : ''} onClick={() => setView('mine')}><FileSearch /> Meus itens</button>
        <button className={view === 'reviews' ? 'active' : ''} onClick={() => setView('reviews')}><ClipboardCheck /> Revisões</button>
        <button className={view === 'approvals' ? 'active' : ''} onClick={() => setView('approvals')}><ShieldCheck /> Aprovações</button>
      </nav>

      {notice && <output className="institutional-notice">{notice}</output>}
      {loading && <div className="institutional-loading"><LoaderCircle className="spin" /> Carregando...</div>}

      {view === 'curricula' && !loading && <>
        <div className="pedagogy-toolbar"><div><strong>Catálogos curriculares</strong><small>BNCC/SAEB são referências protegidas; apenas currículos da rede são editáveis.</small></div><button onClick={() => setShowCurriculumForm((open) => !open)}><Plus /> Currículo da rede</button></div>
        {showCurriculumForm && <form className="institutional-inline-form" onSubmit={createCurriculum}><label><span>Nome</span><input name="name" required minLength={2} /></label><label><span>Versão</span><input name="version" required defaultValue="1.0" /></label><button disabled={busy}>{busy ? 'Salvando...' : 'Criar currículo'}</button></form>}
        <div className="curriculum-cards">
          {curricula.map((curriculum) => <button key={curriculum.id} className={selectedCurriculum === curriculum.id ? 'selected' : ''} onClick={() => setSelectedCurriculum(curriculum.id)}><span className={`curriculum-type ${curriculum.curriculum_type}`}>{curriculum.curriculum_type.toUpperCase()}</span><strong>{curriculum.name}</strong><small>Versão {curriculum.version} · {curriculum.active ? 'Ativo' : 'Inativo'}</small>{curriculum.network_id === null && <em><ShieldCheck /> Referência protegida</em>}</button>)}
        </div>
        {selected && <div className="institutional-panel curriculum-detail"><div className="institutional-panel-head"><div><span>ESTRUTURA SELECIONADA</span><h3>{selected.name}</h3></div>{selected.curriculum_type === 'custom' && <button onClick={() => setShowStructureForm((open) => !open)}><Plus /> Adicionar estrutura</button>}</div>
          <div className="curriculum-metrics"><span><strong>{areas.length}</strong> áreas</span><span><strong>{subjects.length}</strong> componentes</span><span><strong>{years.length}</strong> anos/séries</span><span><strong>{units.length}</strong> unidades</span><span><strong>{objects.length}</strong> objetos</span><span><strong>{skills.length}</strong> habilidades</span></div>
          {showStructureForm && <StructureForm areas={areas} subjects={subjects} years={years} units={units} objects={objects} busy={busy} onSubmit={addStructure} />}
          <div className="skill-list">{skills.slice(0, 12).map((skill) => <article key={skill.id}><strong>{skill.code}</strong><p>{skill.description}</p><span>{years.find((year) => year.id === skill.curriculum_school_year_id)?.name}</span></article>)}{!skills.length && <div className="institutional-empty compact"><LibraryBig /><h3>Nenhuma habilidade carregada</h3><p>A infraestrutura está pronta; o conteúdo pedagógico oficial depende de fonte validada.</p></div>}</div>
        </div>}
        <div className="institutional-panel curriculum-import"><div><Upload /><span><strong>Importar matriz curricular</strong><small>CSV ou JSON com prévia obrigatória. A validação não confirma a importação.</small></span></div><label className="file-button"><input type="file" accept=".csv,.json,application/json,text/csv" onChange={previewImport} />Selecionar arquivo</label>{importPreview && <div className="import-preview"><strong>{importPreview.name}</strong><span>{Math.max(0, importPreview.rows.length - 1)} linhas na prévia</span>{importPreview.errors.map((error) => <p key={error}><CircleAlert /> {error}</p>)}{!importPreview.errors.length && <button disabled={busy} onClick={() => void registerImport()}>Registrar dry-run</button>}</div>}</div>
      </>}

      {view !== 'curricula' && !loading && <>
        <div className="item-dashboard">{dashboard.map(({ status, count }) => <article key={status}><span>{statusLabels[status]}</span><strong>{count}</strong></article>)}<article className={uncoveredSkills ? 'warning' : ''}><span>Habilidades sem itens</span><strong>{uncoveredSkills}</strong></article></div>
        <div className="pedagogy-toolbar item-filters"><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar enunciado ou título" aria-label="Buscar itens" /></label><label><Filter /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar status"><option value="">Todos os status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button onClick={() => void loadItems()}>Aplicar</button><button onClick={() => setShowItemForm((open) => !open)}><Plus /> Novo item</button></div>
        {showItemForm && <ItemForm curricula={curricula} selectedCurriculum={selectedCurriculum} subjects={subjects} years={years} skills={skills} busy={busy} onSubmit={createItem} />}
        <div className="item-list">{items.map((item) => <article key={item.item_id}><div className="item-list-head"><span className={`item-status ${item.item_status}`}>{statusLabels[item.item_status] ?? item.item_status}</span><small>v{item.current_version}</small></div><h3>{item.internal_title}</h3><p>{item.statement}</p><div className="item-tags"><span>{item.subject_name}</span><span>{item.school_year_name}</span><span>{item.skill_code}</span><span>{item.difficulty}</span></div><footer><small>Por {item.author_name} · {new Date(item.updated_at).toLocaleDateString('pt-BR')}</small><ItemActions item={item} role={profile.role} busy={busy} onTransition={transition} /></footer></article>)}{!items.length && <div className="institutional-empty"><BookOpenCheck /><h3>Nenhum item neste filtro</h3><p>Crie um rascunho ou ajuste os filtros de pesquisa.</p></div>}</div>
        <div className="item-pagination"><button disabled={page === 0} onClick={() => setPage((current) => current - 1)} aria-label="Página anterior"><ChevronLeft /></button><span>Página {page + 1} · {totalItems} itens</span><button disabled={(page + 1) * 20 >= totalItems} onClick={() => setPage((current) => current + 1)} aria-label="Próxima página"><ChevronRight /></button></div>
      </>}
    </section>
  );
}

function StructureForm({ areas, subjects, years, units, objects, busy, onSubmit }: { areas: Area[]; subjects: Subject[]; years: CurriculumYear[]; units: Unit[]; objects: KnowledgeObject[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [kind, setKind] = useState('area');
  return <form className="curriculum-structure-form" onSubmit={onSubmit}><label><span>Elemento</span><select name="kind" value={kind} onChange={(event) => setKind(event.target.value)}><option value="area">Área</option><option value="subject">Componente</option><option value="year">Ano/série</option><option value="unit">Unidade temática</option><option value="object">Objeto de conhecimento</option><option value="skill">Habilidade</option></select></label><label><span>Nome</span><input name="name" required={kind !== 'skill'} /></label>{['year', 'skill'].includes(kind) && <label><span>Código</span><input name="code" required /></label>}{kind === 'subject' && <SelectField name="area_id" label="Área" rows={areas} />}{['unit', 'skill'].includes(kind) && <SelectField name="subject_id" label="Componente" rows={subjects} />}{['unit', 'skill'].includes(kind) && <SelectField name="year_id" label="Ano/série" rows={years} />}{['object', 'skill'].includes(kind) && <SelectField name="unit_id" label="Unidade temática" rows={units} optional={kind === 'skill'} />}{kind === 'skill' && <SelectField name="object_id" label="Objeto" rows={objects} optional />}{kind === 'skill' && <label className="wide"><span>Descrição</span><textarea name="description" required minLength={5} /></label>}<button disabled={busy}>{busy ? 'Salvando...' : 'Adicionar'}</button></form>;
}

function SelectField({ name, label, rows, optional = false }: { name: string; label: string; rows: { id: string; name: string }[]; optional?: boolean }) {
  return <label><span>{label}</span><select name={name} required={!optional}><option value="">{optional ? 'Não vincular' : 'Selecione'}</option>{rows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>;
}

function ItemForm({ curricula, selectedCurriculum, subjects, years, skills, busy, onSubmit }: { curricula: Curriculum[]; selectedCurriculum: string; subjects: Subject[]; years: CurriculumYear[]; skills: Skill[]; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [type, setType] = useState('multiple_choice'); const [statement, setStatement] = useState(''); const [formula, setFormula] = useState('');
  const renderedFormula = useMemo(() => formula ? katex.renderToString(formula, { throwOnError: false, trust: false, strict: 'warn' }) : '', [formula]);
  const optionCount = type === 'true_false' ? 2 : 4;
  return <form className="item-editor" onSubmit={onSubmit}><header><div><span>AUTORIA SEGURA</span><h3>Novo item avaliativo</h3><p>O conteúdo é tratado como texto; fórmulas são renderizadas pelo KaTeX sem HTML arbitrário.</p></div><ShieldCheck /></header><div className="item-editor-grid"><label><span>Currículo</span><select name="curriculum_id" defaultValue={selectedCurriculum} required>{curricula.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><SelectField name="subject_id" label="Componente" rows={subjects} /><SelectField name="year_id" label="Ano/série" rows={years} /><label><span>Habilidade</span><select name="skill_id" required><option value="">Selecione</option>{skills.map((row) => <option key={row.id} value={row.id}>{row.code}</option>)}</select></label><label><span>Tipo</span><select name="item_type" value={type} onChange={(event) => setType(event.target.value)}><option value="multiple_choice">Múltipla escolha</option><option value="true_false">Verdadeiro ou falso</option><option value="essay">Dissertativa</option></select></label><label><span>Dificuldade</span><select name="difficulty"><option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option></select></label><label className="wide"><span>Título interno</span><input name="title" required minLength={2} /></label><label className="wide"><span>Texto de apoio</span><textarea name="support_text" /></label><label className="wide"><span>Enunciado</span><textarea name="statement" required minLength={5} value={statement} onChange={(event) => setStatement(event.target.value)} /></label><div className="editor-tools wide"><button type="button" onClick={() => setStatement((value) => `${value} **negrito**`)}><b>B</b><span className="sr-only">Inserir negrito</span></button><button type="button" onClick={() => setStatement((value) => `${value} *itálico*`)}><i>I</i><span className="sr-only">Inserir itálico</span></button><button type="button" onClick={() => setStatement((value) => `${value}\n- item`)}>• Lista</button><label><span>Fórmula KaTeX</span><input value={formula} onChange={(event) => setFormula(event.target.value)} placeholder="Ex.: \\frac{1}{2}" /></label>{renderedFormula && <output className="formula-preview" aria-label="Prévia da fórmula" dangerouslySetInnerHTML={{ __html: renderedFormula }} />}</div>{type !== 'essay' && Array.from({ length: optionCount }, (_, index) => <fieldset className="item-option" key={index}><legend>Alternativa {String.fromCharCode(65 + index)}</legend><label><span>Conteúdo</span><input name={`option_${index}`} required /></label><label className="correct-radio"><input type="radio" name="correct_option" value={index} required /> Correta</label><label><span>Feedback</span><input name={`feedback_${index}`} /></label><label><span>Análise do distrator</span><input name={`analysis_${index}`} /></label></fieldset>)}<label className="wide"><span>Comentário pedagógico</span><textarea name="pedagogical_comment" /></label><label className="wide"><span>Justificativa da resposta correta</span><textarea name="justification" /></label></div><button className="item-save" disabled={busy}>{busy ? 'Salvando...' : 'Salvar rascunho'}</button></form>;
}

function ItemActions({ item, role, busy, onTransition }: { item: ItemListRow; role: InstitutionalProfile['role']; busy: boolean; onTransition: (id: string, action: string) => Promise<void> }) {
  return <div className="item-actions">{['draft', 'rejected'].includes(item.item_status) && <button disabled={busy} onClick={() => void onTransition(item.item_id, 'submit')}><Send /> Enviar</button>}{item.item_status === 'in_review' && ['reviewer', 'approver', 'manager', 'network_admin'].includes(role) && <><button disabled={busy} onClick={() => void onTransition(item.item_id, 'return')}><XCircle /> Devolver</button><button disabled={busy} onClick={() => void onTransition(item.item_id, 'review')}><CheckCircle2 /> Revisar</button></>}{item.item_status === 'reviewed' && ['approver', 'manager', 'network_admin'].includes(role) && <><button disabled={busy} onClick={() => void onTransition(item.item_id, 'reject')}><XCircle /> Rejeitar</button><button disabled={busy} onClick={() => void onTransition(item.item_id, 'approve')}><ShieldCheck /> Aprovar</button></>}{item.item_status !== 'archived' && ['manager', 'network_admin'].includes(role) && <button disabled={busy} onClick={() => void onTransition(item.item_id, 'archive')}><Archive /> Arquivar</button>}</div>;
}
