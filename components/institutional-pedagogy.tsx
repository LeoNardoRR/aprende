'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Archive,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileSearch,
  Filter,
  LibraryBig,
  LoaderCircle,
  Plus,
  Search,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { CurriculumExplorer, ItemCoverage } from './curriculum-explorer';
import { ItemWorkspace } from './item-workspace';
import { institutionalRpc, operationError } from '@/lib/institutional-tools';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import type { InstitutionalProfile } from '@/components/institutional-admin';

type PedagogyProfile = Omit<InstitutionalProfile, 'role'> & {
  role: InstitutionalProfile['role'] | 'teacher';
};
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
  draft: 'Rascunho',
  in_review: 'Em revisão',
  reviewed: 'Revisado',
  approved: 'Aprovado',
  rejected: 'Devolvido',
  archived: 'Arquivado',
};

const previewCurricula: Curriculum[] = [
  {
    id: 'curriculum-bncc',
    network_id: null,
    name: 'BNCC',
    curriculum_type: 'bncc',
    version: 'Referência oficial',
    active: true,
    created_by: null,
    created_at: '2026-09-12T12:00:00Z',
    updated_at: '2026-09-12T12:00:00Z',
  },
  {
    id: 'curriculum-custom',
    network_id: 'network-preview',
    name: 'Currículo Municipal - DEMO',
    curriculum_type: 'custom',
    version: '1.0',
    active: true,
    created_by: 'preview-admin',
    created_at: '2026-09-12T12:00:00Z',
    updated_at: '2026-09-12T12:00:00Z',
  },
];

const previewItems: ItemListRow[] = [
  {
    item_id: 'item-demo-1',
    internal_title: 'DEMO - Frações equivalentes',
    statement: 'Qual fração é equivalente a 1/2?',
    item_type: 'multiple_choice',
    difficulty: 'medium',
    item_status: 'in_review',
    curriculum_name: 'Currículo Municipal - DEMO',
    subject_name: 'Matemática',
    school_year_name: '6º ano',
    skill_code: 'DEMO-EF06MA07',
    author_name: 'Professor Gabriel',
    reviewer_name: null,
    approver_name: null,
    current_version: 1,
    updated_at: '2026-09-12T12:00:00Z',
    total_count: 2,
  },
  {
    item_id: 'item-demo-2',
    internal_title: 'DEMO - Leitura e inferência',
    statement: 'Leia o trecho e identifique a informação implícita.',
    item_type: 'essay',
    difficulty: 'medium',
    item_status: 'approved',
    curriculum_name: 'Currículo Municipal - DEMO',
    subject_name: 'Língua Portuguesa',
    school_year_name: '6º ano',
    skill_code: 'DEMO-EF67LP04',
    author_name: 'Professora Ana',
    reviewer_name: 'Revisão pedagógica',
    approver_name: 'Gestão pedagógica',
    current_version: 3,
    updated_at: '2026-09-11T12:00:00Z',
    total_count: 2,
  },
];

function listItemsType() {
  return Promise.resolve(
    [] as {
      item_id: string;
      internal_title: string;
      statement: string;
      item_type: string;
      difficulty: string;
      item_status: string;
      curriculum_name: string;
      subject_name: string;
      school_year_name: string;
      skill_code: string;
      author_name: string;
      reviewer_name: string | null;
      approver_name: string | null;
      current_version: number;
      updated_at: string;
      total_count: number;
    }[],
  );
}

export function InstitutionalPedagogy({
  profile,
  networks,
  preview = false,
}: {
  profile: PedagogyProfile;
  networks: NetworkRow[];
  preview?: boolean;
}) {
  const [view, setView] = useState<PedagogyView>('curricula');
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? '');
  const [curricula, setCurricula] = useState<Curriculum[]>(
    preview ? previewCurricula : [],
  );
  const [areas, setAreas] = useState<Area[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [years, setYears] = useState<CurriculumYear[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [objects, setObjects] = useState<KnowledgeObject[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [items, setItems] = useState<ItemListRow[]>(
    preview ? previewItems : [],
  );
  const [selectedCurriculum, setSelectedCurriculum] = useState(
    preview ? previewCurricula[0].id : '',
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(!preview);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [showCurriculumForm, setShowCurriculumForm] = useState(false);
  const [showStructureForm, setShowStructureForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemFilters, setItemFilters] = useState<Record<string, string>>({});
  const [openedItem, setOpenedItem] = useState<string | null>(null);

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
    const result = await supabase
      .from('curricula')
      .select('*')
      .or(`network_id.is.null,network_id.eq.${networkId}`)
      .order('name');
    if (result.error)
      setNotice(
        `Não foi possível carregar os currículos: ${result.error.message}`,
      );
    else {
      setCurricula(result.data ?? []);
      setSelectedCurriculum((current) => current || result.data?.[0]?.id || '');
    }
    setLoading(false);
  }, [networkId, preview]);

  const loadStructure = useCallback(async () => {
    if (preview || !selectedCurriculum) return;
    const [
      areaResult,
      subjectResult,
      yearResult,
      unitResult,
      objectResult,
      skillResult,
    ] = await Promise.all([
      supabase
        .from('curriculum_areas')
        .select('*')
        .eq('curriculum_id', selectedCurriculum)
        .order('sort_order'),
      supabase
        .from('curriculum_subjects')
        .select('*')
        .eq('curriculum_id', selectedCurriculum)
        .order('sort_order'),
      supabase
        .from('curriculum_school_years')
        .select('*')
        .eq('curriculum_id', selectedCurriculum)
        .order('sort_order'),
      supabase
        .from('curriculum_thematic_units')
        .select('*')
        .eq('curriculum_id', selectedCurriculum)
        .order('sort_order'),
      supabase
        .from('curriculum_knowledge_objects')
        .select('*')
        .eq('curriculum_id', selectedCurriculum)
        .order('sort_order'),
      supabase
        .from('curriculum_skills')
        .select('*')
        .eq('curriculum_id', selectedCurriculum)
        .order('code'),
    ]);
    const error = [
      areaResult,
      subjectResult,
      yearResult,
      unitResult,
      objectResult,
      skillResult,
    ].find((result) => result.error)?.error;
    if (error)
      setNotice(`Não foi possível carregar a estrutura: ${error.message}`);
    setAreas(areaResult.data ?? []);
    setSubjects(subjectResult.data ?? []);
    setYears(yearResult.data ?? []);
    setUnits(unitResult.data ?? []);
    setObjects(objectResult.data ?? []);
    setSkills(skillResult.data ?? []);
  }, [preview, selectedCurriculum]);

  const loadItems = useCallback(async () => {
    if (preview || !networkId) return;
    setLoading(true);
    const effectiveStatus =
      view === 'reviews'
        ? 'in_review'
        : view === 'approvals'
          ? 'reviewed'
          : statusFilter;
    try {
      const data = await institutionalRpc<ItemListRow[]>(
        'item_bank_directory',
        {
          target_network: networkId,
          filters: {
            ...itemFilters,
            status: effectiveStatus,
            search,
            author: view === 'mine' ? profile.id : (itemFilters.author ?? ''),
          },
          page_size: 20,
          page_offset: page * 20,
        },
      );
      setItems(data);
    } catch (error) {
      setNotice(operationError(error));
    }
    setLoading(false);
  }, [
    networkId,
    page,
    preview,
    profile.id,
    search,
    statusFilter,
    view,
    itemFilters,
  ]);

  useEffect(() => {
    void loadCurricula();
  }, [loadCurricula]);
  useEffect(() => {
    void loadStructure();
  }, [loadStructure]);
  useEffect(() => {
    if (view !== 'curricula') void loadItems();
  }, [loadItems, view]);

  const selected = curricula.find(
    (curriculum) => curriculum.id === selectedCurriculum,
  );
  const totalItems = items[0]?.total_count ?? 0;
  async function createCurriculum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    const form = new FormData(event.currentTarget);
    if (preview) {
      setCurricula((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          network_id: networkId,
          name: String(form.get('name')),
          curriculum_type: 'custom',
          version: String(form.get('version')),
          active: true,
          created_by: profile.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      setNotice('Currículo criado na prévia.');
    } else {
      const curriculumName = String(form.get('name')).trim();
      const curriculumVersion = String(form.get('version')).trim();
      const result = await supabase.from('curricula').insert({
        network_id: networkId,
        name: curriculumName,
        curriculum_type: 'custom',
        version: curriculumVersion,
        created_by: profile.id,
      });
      if (result.error)
        setNotice(`Não foi possível criar: ${result.error.message}`);
      else {
        await loadCurricula();
        const created = await supabase
          .from('curricula')
          .select('id')
          .eq('network_id', networkId)
          .eq('name', curriculumName)
          .eq('version', curriculumVersion)
          .maybeSingle();
        if (created.data?.id) setSelectedCurriculum(created.data.id);
        setNotice('Currículo próprio criado.');
      }
    }
    setBusy(false);
    setShowCurriculumForm(false);
  }

  async function addStructure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    const form = new FormData(event.currentTarget);
    const kind = String(form.get('kind'));
    const name = String(form.get('name')).trim();
    let error: { message: string } | null = null;
    if (!preview) {
      if (kind === 'area')
        ({ error } = await supabase
          .from('curriculum_areas')
          .insert({ curriculum_id: selectedCurriculum, name }));
      if (kind === 'subject')
        ({ error } = await supabase.from('curriculum_subjects').insert({
          curriculum_id: selectedCurriculum,
          area_id: String(form.get('area_id')),
          name,
        }));
      if (kind === 'year')
        ({ error } = await supabase.from('curriculum_school_years').insert({
          curriculum_id: selectedCurriculum,
          code: String(form.get('code')).trim(),
          name,
        }));
      if (kind === 'unit')
        ({ error } = await supabase.from('curriculum_thematic_units').insert({
          curriculum_id: selectedCurriculum,
          subject_id: String(form.get('subject_id')),
          curriculum_school_year_id: String(form.get('year_id')),
          name,
        }));
      if (kind === 'object')
        ({ error } = await supabase
          .from('curriculum_knowledge_objects')
          .insert({
            curriculum_id: selectedCurriculum,
            thematic_unit_id: String(form.get('unit_id')),
            name,
          }));
      if (kind === 'skill')
        ({ error } = await supabase.from('curriculum_skills').insert({
          curriculum_id: selectedCurriculum,
          subject_id: String(form.get('subject_id')),
          curriculum_school_year_id: String(form.get('year_id')),
          thematic_unit_id: String(form.get('unit_id')) || null,
          knowledge_object_id: String(form.get('object_id')) || null,
          code: String(form.get('code')).trim().toUpperCase(),
          description: String(form.get('description')).trim(),
        }));
    }
    setBusy(false);
    if (error) setNotice(`Não foi possível adicionar: ${error.message}`);
    else {
      setNotice(
        preview
          ? 'Estrutura validada na prévia.'
          : 'Estrutura curricular atualizada.',
      );
      setShowStructureForm(false);
      await loadStructure();
    }
  }

  async function transition(itemId: string, action: string) {
    const comment = window.prompt(
      ['return', 'reject'].includes(action)
        ? 'Motivo obrigatório (mínimo 5 caracteres):'
        : 'Comentário da decisão:',
    );
    if (comment === null) return;
    if (['return', 'reject'].includes(action) && comment.trim().length < 5) {
      setNotice('Informe o motivo com pelo menos 5 caracteres.');
      return;
    }
    if (action === 'archive' && !window.confirm('Arquivar este item?')) return;
    setBusy(true);
    if (preview)
      setItems((current) =>
        current.map((item) =>
          item.item_id === itemId
            ? {
                ...item,
                item_status:
                  action === 'submit'
                    ? 'in_review'
                    : action === 'review'
                      ? 'reviewed'
                      : action === 'approve'
                        ? 'approved'
                        : action === 'archive'
                          ? 'archived'
                          : 'rejected',
              }
            : item,
        ),
      );
    else {
      const result = await supabase.rpc('transition_assessment_item', {
        target_item: itemId,
        target_action: action,
        action_comment: comment,
      });
      setNotice(
        result.error
          ? `A transição foi recusada: ${result.error.message}`
          : 'Status atualizado e versão preservada.',
      );
      if (!result.error) await loadItems();
    }
    setBusy(false);
  }

  return (
    <section id="curricula" className="institutional-pedagogy">
      <span
        id="item-bank"
        className="institutional-anchor"
        aria-hidden="true"
      />
      <div className="institutional-panel-head">
        <div>
          <span>GESTÃO PEDAGÓGICA</span>
          <h2>Currículos e Banco de Itens</h2>
          <p>Estrutura curricular, autoria e aprovação com histórico.</p>
        </div>
        <label className="institutional-field compact">
          <span>Rede</span>
          <select
            value={networkId}
            onChange={(event) => setNetworkId(event.target.value)}
            aria-label="Selecionar rede"
          >
            {networks.map((network) => (
              <option key={network.id} value={network.id}>
                {network.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav className="pedagogy-tabs" aria-label="Navegação pedagógica">
        <button
          className={view === 'curricula' ? 'active' : ''}
          onClick={() => {
            setPage(0);
            setView('curricula');
          }}
        >
          <LibraryBig /> Currículos
        </button>
        <button
          className={view === 'items' ? 'active' : ''}
          onClick={() => {
            setPage(0);
            setView('items');
          }}
        >
          <BookOpenCheck /> Banco de Itens
        </button>
        <button
          className={view === 'mine' ? 'active' : ''}
          onClick={() => {
            setPage(0);
            setView('mine');
          }}
        >
          <FileSearch /> Meus itens
        </button>
        <button
          className={view === 'reviews' ? 'active' : ''}
          onClick={() => {
            setPage(0);
            setView('reviews');
          }}
        >
          <ClipboardCheck /> Revisões
        </button>
        <button
          className={view === 'approvals' ? 'active' : ''}
          onClick={() => {
            setPage(0);
            setView('approvals');
          }}
        >
          <ShieldCheck /> Aprovações
        </button>
      </nav>

      {notice && <output className="institutional-notice">{notice}</output>}
      {loading && (
        <div className="institutional-loading">
          <LoaderCircle className="spin" /> Carregando...
        </div>
      )}

      {view === 'curricula' && !loading && (
        <>
          <div className="pedagogy-toolbar">
            <div>
              <strong>Catálogos curriculares</strong>
              <small>
                BNCC/SAEB são referências protegidas; apenas currículos da rede
                são editáveis.
              </small>
            </div>
            <button onClick={() => setShowCurriculumForm((open) => !open)}>
              <Plus /> Currículo da rede
            </button>
          </div>
          {showCurriculumForm && (
            <form
              className="institutional-inline-form"
              onSubmit={createCurriculum}
            >
              <label>
                <span>Nome</span>
                <input name="name" required minLength={2} />
              </label>
              <label>
                <span>Versão</span>
                <input name="version" required defaultValue="1.0" />
              </label>
              <button disabled={busy}>
                {busy ? 'Salvando...' : 'Criar currículo'}
              </button>
            </form>
          )}
          <div className="curriculum-cards">
            {curricula.map((curriculum) => (
              <button
                key={curriculum.id}
                className={
                  selectedCurriculum === curriculum.id ? 'selected' : ''
                }
                onClick={() => setSelectedCurriculum(curriculum.id)}
              >
                <span
                  className={`curriculum-type ${curriculum.curriculum_type}`}
                >
                  {curriculum.curriculum_type.toUpperCase()}
                </span>
                <strong>{curriculum.name}</strong>
                <small>
                  Versão {curriculum.version} ·{' '}
                  {curriculum.active ? 'Ativo' : 'Inativo'}
                </small>
                {curriculum.network_id === null && (
                  <em>
                    <ShieldCheck /> Referência protegida
                  </em>
                )}
              </button>
            ))}
          </div>
          {selected && (
            <div className="institutional-panel curriculum-detail">
              <div className="institutional-panel-head">
                <div>
                  <span>ESTRUTURA SELECIONADA</span>
                  <h3>{selected.name}</h3>
                </div>
                {selected.curriculum_type === 'custom' && (
                  <button onClick={() => setShowStructureForm((open) => !open)}>
                    <Plus /> Adicionar estrutura
                  </button>
                )}
              </div>
              <div className="curriculum-metrics">
                <span>
                  <strong>{areas.length}</strong> áreas
                </span>
                <span>
                  <strong>{subjects.length}</strong> componentes
                </span>
                <span>
                  <strong>{years.length}</strong> anos/séries
                </span>
                <span>
                  <strong>{units.length}</strong> unidades
                </span>
                <span>
                  <strong>{objects.length}</strong> objetos
                </span>
                <span>
                  <strong>{skills.length}</strong> habilidades
                </span>
              </div>
              {showStructureForm && (
                <StructureForm
                  areas={areas}
                  subjects={subjects}
                  years={years}
                  units={units}
                  objects={objects}
                  busy={busy}
                  onSubmit={addStructure}
                />
              )}
              <CurriculumExplorer
                key={selected.id}
                network={networkId}
                curriculum={selected.id}
                official={selected.curriculum_type !== 'custom'}
                areas={areas}
                subjects={subjects}
                years={years}
                units={units}
                objects={objects}
                preview={preview}
                onImported={() => void loadStructure()}
              />
            </div>
          )}
        </>
      )}

      {view !== 'curricula' && !loading && (
        <>
          <ItemCoverage
            key={`${networkId}-${selectedCurriculum}`}
            network={networkId}
            curriculum={selectedCurriculum}
            preview={preview}
          />
          <div className="phase12-box phase12-grid">
            <label>
              Currículo do painel
              <select
                value={selectedCurriculum}
                onChange={(e) => {
                  setSelectedCurriculum(e.target.value);
                  setItemFilters({ curriculum: e.target.value });
                  setPage(0);
                }}
              >
                <option value="">Selecione</option>
                {curricula.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {(['subject', 'year', 'skill', 'difficulty', 'type'] as const).map(
              (key) => (
                <label key={key}>
                  {
                    {
                      subject: 'Componente',
                      year: 'Série',
                      skill: 'Habilidade',
                      difficulty: 'Dificuldade',
                      type: 'Tipo',
                    }[key]
                  }
                  <select
                    value={itemFilters[key] ?? ''}
                    onChange={(e) => {
                      setItemFilters((f) => ({ ...f, [key]: e.target.value }));
                      setPage(0);
                    }}
                  >
                    <option value="">Todos</option>
                    {(key === 'subject'
                      ? subjects.map((r) => [r.id, r.name])
                      : key === 'year'
                        ? years.map((r) => [r.id, r.name])
                        : key === 'skill'
                          ? skills.map((r) => [r.id, r.code])
                          : key === 'difficulty'
                            ? [
                                ['easy', 'Fácil'],
                                ['medium', 'Média'],
                                ['hard', 'Difícil'],
                              ]
                            : [
                                ['multiple_choice', 'Múltipla escolha'],
                                ['true_false', 'Verdadeiro ou falso'],
                                ['essay', 'Dissertativa'],
                              ]
                    ).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              ),
            )}
            {(['author', 'reviewer', 'approver'] as const).map((key) => (
              <label key={key}>
                {
                  {
                    author: 'Nome do autor',
                    reviewer: 'Nome do revisor',
                    approver: 'Nome do aprovador',
                  }[key]
                }
                <input
                  value={itemFilters[key] ?? ''}
                  onChange={(e) => {
                    setItemFilters((f) => ({ ...f, [key]: e.target.value }));
                    setPage(0);
                  }}
                />
              </label>
            ))}
          </div>
          <div className="pedagogy-toolbar item-filters">
            <label>
              <Search />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                placeholder="Buscar enunciado ou título"
                aria-label="Buscar itens"
              />
            </label>
            <label>
              <Filter />
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(0);
                }}
                aria-label="Filtrar status"
              >
                <option value="">Todos os status</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={() => void loadItems()}>Aplicar</button>
            <button
              onClick={() => {
                setOpenedItem(null);
                setShowItemForm((open) => !open);
              }}
            >
              <Plus /> Novo item
            </button>
          </div>
          {showItemForm && (
            <ItemWorkspace
              key={openedItem ?? 'new'}
              network={networkId}
              itemId={openedItem}
              curricula={curricula}
              preview={preview}
              onClose={() => setShowItemForm(false)}
              onSaved={() => void loadItems()}
            />
          )}

          <div className="item-list">
            {items.map((item) => (
              <article key={item.item_id}>
                <div className="item-list-head">
                  <span className={`item-status ${item.item_status}`}>
                    {statusLabels[item.item_status] ?? item.item_status}
                  </span>
                  <small>v{item.current_version}</small>
                </div>
                <h3>{item.internal_title}</h3>
                <p>{item.statement}</p>
                <div className="item-tags">
                  <span>{item.subject_name}</span>
                  <span>{item.school_year_name}</span>
                  <span>{item.skill_code}</span>
                  <span>{item.difficulty}</span>
                </div>
                <footer>
                  <small>
                    Por {item.author_name} ·{' '}
                    {new Date(item.updated_at).toLocaleDateString('pt-BR')}
                  </small>
                  <button
                    onClick={() => {
                      setOpenedItem(item.item_id);
                      setShowItemForm(true);
                    }}
                  >
                    Abrir / editar / versões
                  </button>
                  <ItemActions
                    item={item}
                    role={profile.role}
                    busy={busy}
                    onTransition={transition}
                  />
                </footer>
              </article>
            ))}
            {!items.length && (
              <div className="institutional-empty">
                <BookOpenCheck />
                <h3>Nenhum item neste filtro</h3>
                <p>Crie um rascunho ou ajuste os filtros de pesquisa.</p>
              </div>
            )}
          </div>
          <div className="item-pagination">
            <button
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft />
            </button>
            <span>
              Página {page + 1} · {totalItems} itens
            </span>
            <button
              disabled={(page + 1) * 20 >= totalItems}
              onClick={() => setPage((current) => current + 1)}
              aria-label="Próxima página"
            >
              <ChevronRight />
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function StructureForm({
  areas,
  subjects,
  years,
  units,
  objects,
  busy,
  onSubmit,
}: {
  areas: Area[];
  subjects: Subject[];
  years: CurriculumYear[];
  units: Unit[];
  objects: KnowledgeObject[];
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [kind, setKind] = useState('area');
  return (
    <form className="curriculum-structure-form" onSubmit={onSubmit}>
      <label>
        <span>Elemento</span>
        <select
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="area">Área</option>
          <option value="subject">Componente</option>
          <option value="year">Ano/série</option>
          <option value="unit">Unidade temática</option>
          <option value="object">Objeto de conhecimento</option>
          <option value="skill">Habilidade</option>
        </select>
      </label>
      <label>
        <span>Nome</span>
        <input name="name" required={kind !== 'skill'} />
      </label>
      {['year', 'skill'].includes(kind) && (
        <label>
          <span>Código</span>
          <input name="code" required />
        </label>
      )}
      {kind === 'subject' && (
        <SelectField name="area_id" label="Área" rows={areas} />
      )}
      {['unit', 'skill'].includes(kind) && (
        <SelectField name="subject_id" label="Componente" rows={subjects} />
      )}
      {['unit', 'skill'].includes(kind) && (
        <SelectField name="year_id" label="Ano/série" rows={years} />
      )}
      {['object', 'skill'].includes(kind) && (
        <SelectField
          name="unit_id"
          label="Unidade temática"
          rows={units}
          optional={kind === 'skill'}
        />
      )}
      {kind === 'skill' && (
        <SelectField name="object_id" label="Objeto" rows={objects} optional />
      )}
      {kind === 'skill' && (
        <label className="wide">
          <span>Descrição</span>
          <textarea name="description" required minLength={5} />
        </label>
      )}
      <button disabled={busy}>{busy ? 'Salvando...' : 'Adicionar'}</button>
    </form>
  );
}

function SelectField({
  name,
  label,
  rows,
  optional = false,
}: {
  name: string;
  label: string;
  rows: { id: string; name: string }[];
  optional?: boolean;
}) {
  return (
    <label>
      <span>{label}</span>
      <select name={name} required={!optional}>
        <option value="">{optional ? 'Não vincular' : 'Selecione'}</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ItemActions({
  item,
  role,
  busy,
  onTransition,
}: {
  item: ItemListRow;
  role: PedagogyProfile['role'];
  busy: boolean;
  onTransition: (id: string, action: string) => Promise<void>;
}) {
  return (
    <div className="item-actions">
      {['draft', 'rejected'].includes(item.item_status) && (
        <button
          disabled={busy}
          onClick={() => void onTransition(item.item_id, 'submit')}
        >
          <Send /> Enviar
        </button>
      )}
      {item.item_status === 'in_review' &&
        ['reviewer', 'approver', 'manager', 'network_admin'].includes(role) && (
          <>
            <button
              disabled={busy}
              onClick={() => void onTransition(item.item_id, 'return')}
            >
              <XCircle /> Devolver
            </button>
            <button
              disabled={busy}
              onClick={() => void onTransition(item.item_id, 'review')}
            >
              <CheckCircle2 /> Revisar
            </button>
          </>
        )}
      {item.item_status === 'reviewed' &&
        ['approver', 'manager', 'network_admin'].includes(role) && (
          <>
            <button
              disabled={busy}
              onClick={() => void onTransition(item.item_id, 'reject')}
            >
              <XCircle /> Rejeitar
            </button>
            <button
              disabled={busy}
              onClick={() => void onTransition(item.item_id, 'approve')}
            >
              <ShieldCheck /> Aprovar
            </button>
          </>
        )}
      {item.item_status !== 'archived' &&
        ['manager', 'network_admin'].includes(role) && (
          <button
            disabled={busy}
            onClick={() => void onTransition(item.item_id, 'archive')}
          >
            <Archive /> Arquivar
          </button>
        )}
    </div>
  );
}
