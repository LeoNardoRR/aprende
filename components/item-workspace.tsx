'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import katex from 'katex';
import { supabase } from '@/lib/supabase';
import { institutionalRpc, operationError } from '@/lib/institutional-tools';
import type { Tables } from '@/lib/database.types';
type Payload = {
  curriculum_id: string;
  subject_id: string;
  curriculum_school_year_id: string;
  skill_id: string;
  internal_title: string;
  statement: string;
  support_text: string;
  pedagogical_comment: string;
  correct_answer_justification: string;
  difficulty: string;
  item_type: string;
  formula: string;
};
type Option = {
  content: string;
  is_correct: boolean;
  feedback: string;
  distractor_analysis: string;
};
type Item = Tables<'assessment_items'> & {
  formula: string | null;
  image_paths: string[];
  revision_of: string | null;
};
type Version = {
  id: string;
  version_number: number;
  snapshot: Record<string, unknown>;
  created_at: string;
};
const empty: Payload = {
  curriculum_id: '',
  subject_id: '',
  curriculum_school_year_id: '',
  skill_id: '',
  internal_title: '',
  statement: '',
  support_text: '',
  pedagogical_comment: '',
  correct_answer_justification: '',
  difficulty: 'medium',
  item_type: 'multiple_choice',
  formula: '',
};
const emptyOptions = () =>
  Array.from({ length: 4 }, (_, i) => ({
    content: '',
    is_correct: i === 0,
    feedback: '',
    distractor_analysis: '',
  }));
function QuestionPreview({
  payload,
  options,
}: {
  payload: Payload;
  options: Option[];
}) {
  const formula = useMemo(
    () =>
      payload.formula
        ? katex.renderToString(payload.formula, {
            throwOnError: false,
            trust: false,
            strict: 'warn',
          })
        : '',
    [payload.formula],
  );
  return (
    <section className="phase12-preview" aria-label="Prévia da questão">
      <h4>{payload.internal_title || 'Título da questão'}</h4>
      <p>{payload.support_text}</p>
      <p>{payload.statement || 'Enunciado'}</p>
      {formula && <div dangerouslySetInnerHTML={{ __html: formula }} />}
      {payload.item_type !== 'essay' && (
        <ol type="A">
          {options
            .slice(0, payload.item_type === 'true_false' ? 2 : 4)
            .map((o, i) => (
              <li key={i}>
                {o.content} {o.is_correct ? '✓' : ''}
                <small>
                  {' '}
                  {o.is_correct
                    ? payload.correct_answer_justification
                    : o.distractor_analysis}
                </small>
              </li>
            ))}
        </ol>
      )}
      <p>Comentário pedagógico: {payload.pedagogical_comment}</p>
    </section>
  );
}
export function ItemWorkspace({
  network,
  itemId,
  curricula,
  preview = false,
  onClose,
  onSaved,
}: {
  network: string;
  itemId: string | null;
  curricula: Tables<'curricula'>[];
  preview?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [id, setId] = useState(itemId),
    [item, setItem] = useState<Item | null>(null),
    [payload, setPayload] = useState<Payload>({
      ...empty,
      curriculum_id: curricula[0]?.id ?? '',
    }),
    [options, setOptions] = useState<Option[]>(emptyOptions),
    [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]),
    [years, setYears] = useState<{ id: string; name: string }[]>([]),
    [skills, setSkills] = useState<
      { id: string; code: string; description: string; total_count: number }[]
    >([]),
    [skillSearch, setSkillSearch] = useState(''),
    [skillPage, setSkillPage] = useState(0),
    [versions, setVersions] = useState<Version[]>([]),
    [history, setHistory] = useState<
      {
        action: string;
        comment: string | null;
        actor_id: string;
        actor_name: string;
        created_at: string;
      }[]
    >([]),
    [left, setLeft] = useState(''),
    [right, setRight] = useState(''),
    [images, setImages] = useState<{ path: string; url: string }[]>([]),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(!!itemId),
    [showPreview, setShowPreview] = useState(false);
  const editable = !item || ['draft', 'rejected'].includes(item.status);
  const load = useCallback(async () => {
    if (preview || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [data, opts, vers, reviews] = await Promise.all([
        supabase.from('assessment_items').select('*').eq('id', id).single(),
        supabase
          .from('assessment_item_options')
          .select('*')
          .eq('item_id', id)
          .order('sort_order'),
        supabase
          .from('assessment_item_versions')
          .select('*')
          .eq('item_id', id)
          .order('version_number', { ascending: false })
          .limit(100),
        institutionalRpc<typeof history>('item_editorial_history', {
          target_item: id,
        }).then((data) => ({ data, error: null })),
      ]);
      for (const r of [data, opts, vers, reviews]) if (r.error) throw r.error;
      const record = data.data as Item;
      setItem(record);
      setPayload(
        Object.fromEntries(
          Object.keys(empty).map((key) => [
            key,
            String((record as unknown as Record<string, unknown>)[key] ?? ''),
          ]),
        ) as Payload,
      );
      setOptions(
        opts.data?.length
          ? opts.data.map((o) => ({
              content: o.content,
              is_correct: o.is_correct,
              feedback: o.feedback ?? '',
              distractor_analysis: o.distractor_analysis ?? '',
            }))
          : emptyOptions(),
      );
      const frozen = vers.data as unknown as Version[];
      setVersions(frozen);
      setLeft(frozen[1]?.id ?? frozen[0]?.id ?? '');
      setRight(frozen[0]?.id ?? '');
      setHistory(reviews.data ?? []);
      const paths = record.image_paths ?? [];
      if (paths.length) {
        const signed = await supabase.storage
          .from('assessment-item-images')
          .createSignedUrls(paths, 300);
        if (signed.error) throw signed.error;
        setImages(
          (signed.data ?? []).map((r) => ({
            path: r.path ?? '',
            url: r.signedUrl ?? '',
          })),
        );
      } else setImages([]);
    } catch (error) {
      setNotice(operationError(error));
    } finally {
      setLoading(false);
    }
  }, [id, preview]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (preview || !payload.curriculum_id) return;
    let active = true;
    void Promise.all([
      supabase
        .from('curriculum_subjects')
        .select('id,name')
        .eq('curriculum_id', payload.curriculum_id)
        .order('name'),
      supabase
        .from('curriculum_school_years')
        .select('id,name')
        .eq('curriculum_id', payload.curriculum_id)
        .order('sort_order'),
    ]).then(([s, y]) => {
      if (!active) return;
      if (s.error || y.error) {
        setNotice('Não foi possível carregar componentes e séries.');
        return;
      }
      setSubjects(s.data ?? []);
      setYears(y.data ?? []);
    });
    return () => {
      active = false;
    };
  }, [payload.curriculum_id, preview]);
  useEffect(() => {
    if (preview || !payload.curriculum_id) return;
    let active = true;
    void institutionalRpc<typeof skills>('curriculum_skill_directory', {
      target_curriculum: payload.curriculum_id,
      filters: {
        subject: payload.subject_id,
        year: payload.curriculum_school_year_id,
        search: skillSearch,
      },
      page_size: 50,
      page_offset: skillPage * 50,
    })
      .then((data) => {
        if (active) setSkills(data);
      })
      .catch((error) => {
        if (active) setNotice(operationError(error));
      });
    return () => {
      active = false;
    };
  }, [
    payload.curriculum_id,
    payload.subject_id,
    payload.curriculum_school_year_id,
    skillSearch,
    skillPage,
    preview,
  ]);
  function change(key: keyof Payload, value: string) {
    setPayload((p) => ({
      ...p,
      [key]: value,
      ...(key === 'curriculum_id'
        ? { subject_id: '', curriculum_school_year_id: '', skill_id: '' }
        : key === 'subject_id' || key === 'curriculum_school_year_id'
          ? { skill_id: '' }
          : {}),
    }));
    setShowPreview(false);
    if (
      ['curriculum_id', 'subject_id', 'curriculum_school_year_id'].includes(key)
    )
      setSkillPage(0);
  }
  async function save() {
    setBusy(true);
    try {
      if (preview) throw new Error('Modo DEMO: gravação desabilitada.');
      const result = await institutionalRpc<string>('save_assessment_item', {
        target_network: network,
        target_item: id,
        payload,
        item_options:
          payload.item_type === 'essay'
            ? []
            : options.slice(0, payload.item_type === 'true_false' ? 2 : 4),
      });
      setId(result);
      setNotice('Rascunho e alternativas salvos na mesma transação.');
      onSaved();
      if (id) await load();
    } catch (error) {
      setNotice(operationError(error));
    } finally {
      setBusy(false);
    }
  }
  async function revise() {
    setBusy(true);
    try {
      const result = await institutionalRpc<string>('revise_assessment_item', {
        target_item: id,
      });
      setId(result);
      setNotice(
        'Novo rascunho criado. O item aprovado e suas versões permanecem preservados.',
      );
      onSaved();
    } catch (error) {
      setNotice(operationError(error));
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file || !id) return;
    setBusy(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const allowed: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
      };
      if (!ext || allowed[ext] !== file.type || file.size > 5242880)
        throw new Error('Use PNG, JPEG ou WebP, até 5 MB.');
      const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      if (
        (file.type === 'image/png' &&
          ![137, 80, 78, 71, 13, 10, 26, 10].every(
            (v, i) => signature[i] === v,
          )) ||
        (file.type === 'image/jpeg' &&
          !(
            signature[0] === 255 &&
            signature[1] === 216 &&
            signature[2] === 255
          )) ||
        (file.type === 'image/webp' &&
          !(
            String.fromCharCode(...signature.slice(0, 4)) === 'RIFF' &&
            String.fromCharCode(...signature.slice(8, 12)) === 'WEBP'
          ))
      )
        throw new Error(
          'O conteúdo do arquivo não corresponde ao formato da imagem.',
        );
      const path = `${network}/${id}/${crypto.randomUUID()}.${ext}`;
      const result = await supabase.storage
        .from('assessment-item-images')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (result.error) throw result.error;
      try {
        await institutionalRpc('set_item_images', {
          target_item: id,
          paths: [...images.map((i) => i.path), path],
        });
      } catch (error) {
        await supabase.storage.from('assessment-item-images').remove([path]);
        throw error;
      }
      await load();
      setNotice('Imagem privada adicionada.');
    } catch (error) {
      setNotice(operationError(error));
    } finally {
      setBusy(false);
    }
  }
  async function removeImage(path: string) {
    if (
      !window.confirm(
        'Remover esta imagem do rascunho? Imagens de versões anteriores permanecerão preservadas.',
      )
    )
      return;
    setBusy(true);
    try {
      await institutionalRpc('set_item_images', {
        target_item: id,
        paths: images.filter((i) => i.path !== path).map((i) => i.path),
      });
      const removed = await supabase.storage
        .from('assessment-item-images')
        .remove([path]);
      if (removed.error) throw removed.error;
      await load();
      setNotice(
        'Imagem removida do rascunho. Arquivos de versões imutáveis são preservados.',
      );
    } catch (error) {
      setNotice(operationError(error));
    } finally {
      setBusy(false);
    }
  }
  const count = payload.item_type === 'true_false' ? 2 : 4;
  return (
    <section className="phase12-box" aria-label="Editor e histórico do item">
      <h3>
        {id ? 'Item: edição, imagens e histórico' : 'Novo item avaliativo'}
      </h3>
      <button onClick={onClose}>Fechar editor</button>
      {loading ? (
        <p role="status">Carregando item…</p>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!showPreview) {
                setShowPreview(true);
                return;
              }
              void save();
            }}
          >
            <fieldset disabled={!editable || busy || preview}>
              <div className="phase12-grid">
                <label>
                  Currículo
                  <select
                    required
                    value={payload.curriculum_id}
                    onChange={(e) => change('curriculum_id', e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {curricula.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Componente
                  <select
                    required
                    value={payload.subject_id}
                    onChange={(e) => change('subject_id', e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Série
                  <select
                    required
                    value={payload.curriculum_school_year_id}
                    onChange={(e) =>
                      change('curriculum_school_year_id', e.target.value)
                    }
                  >
                    <option value="">Selecione</option>
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Buscar habilidade
                  <input
                    value={skillSearch}
                    onChange={(e) => {
                      setSkillSearch(e.target.value);
                      setSkillPage(0);
                    }}
                  />
                </label>
                <label>
                  Habilidade curricular
                  <select
                    required
                    value={payload.skill_id}
                    onChange={(e) => change('skill_id', e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {payload.skill_id &&
                      !skills.some((s) => s.id === payload.skill_id) && (
                        <option value={payload.skill_id}>
                          Habilidade vinculada — {payload.skill_id}
                        </option>
                      )}
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {s.description.slice(0, 100)}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <button
                    type="button"
                    disabled={skillPage === 0}
                    onClick={() => setSkillPage((p) => p - 1)}
                  >
                    Habilidades anteriores
                  </button>
                  <button
                    type="button"
                    disabled={
                      (skillPage + 1) * 50 >= (skills[0]?.total_count ?? 0)
                    }
                    onClick={() => setSkillPage((p) => p + 1)}
                  >
                    Próximas habilidades
                  </button>
                </div>
                <label>
                  Tipo
                  <select
                    value={payload.item_type}
                    onChange={(e) => {
                      change('item_type', e.target.value);
                      setOptions(emptyOptions());
                    }}
                  >
                    <option value="multiple_choice">
                      Múltipla escolha — 4 alternativas
                    </option>
                    <option value="true_false">Verdadeiro ou falso</option>
                    <option value="essay">Dissertativa</option>
                  </select>
                </label>
                <label>
                  Dificuldade
                  <select
                    value={payload.difficulty}
                    onChange={(e) => change('difficulty', e.target.value)}
                  >
                    {['easy', 'medium', 'hard'].map((v) => (
                      <option key={v} value={v}>
                        {{ easy: 'Fácil', medium: 'Média', hard: 'Difícil' }[v]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {(
                [
                  'internal_title',
                  'support_text',
                  'statement',
                  'formula',
                  'pedagogical_comment',
                  'correct_answer_justification',
                ] as const
              ).map((key) => (
                <label key={key}>
                  {
                    {
                      internal_title: 'Título interno',
                      support_text: 'Texto de apoio',
                      statement: 'Enunciado',
                      formula: 'Fórmula KaTeX (persistida)',
                      pedagogical_comment: 'Comentário pedagógico',
                      correct_answer_justification: 'Justificativa da correta',
                    }[key]
                  }
                  <textarea
                    required={
                      [
                        'internal_title',
                        'statement',
                        'pedagogical_comment',
                      ].includes(key) ||
                      (key === 'correct_answer_justification' &&
                        payload.item_type !== 'essay')
                    }
                    minLength={
                      [
                        'statement',
                        'pedagogical_comment',
                        'correct_answer_justification',
                      ].includes(key)
                        ? 5
                        : undefined
                    }
                    value={payload[key]}
                    onChange={(e) => change(key, e.target.value)}
                  />
                </label>
              ))}
              {payload.item_type !== 'essay' &&
                options.slice(0, count).map((option, index) => (
                  <fieldset key={index}>
                    <legend>
                      Alternativa {String.fromCharCode(65 + index)}
                    </legend>
                    <label>
                      Texto
                      <input
                        required
                        value={option.content}
                        onChange={(e) => {
                          setOptions((rows) =>
                            rows.map((o, i) =>
                              i === index
                                ? { ...o, content: e.target.value }
                                : o,
                            ),
                          );
                          setShowPreview(false);
                        }}
                      />
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="correct"
                        checked={option.is_correct}
                        onChange={() => {
                          setOptions((rows) =>
                            rows.map((o, i) => ({
                              ...o,
                              is_correct: i === index,
                            })),
                          );
                          setShowPreview(false);
                        }}
                      />{' '}
                      Resposta correta
                    </label>
                    <label>
                      Feedback
                      <input
                        value={option.feedback}
                        onChange={(e) => {
                          setOptions((rows) =>
                            rows.map((o, i) =>
                              i === index
                                ? { ...o, feedback: e.target.value }
                                : o,
                            ),
                          );
                          setShowPreview(false);
                        }}
                      />
                    </label>
                    {!option.is_correct && (
                      <label>
                        Análise do distrator
                        <input
                          required
                          minLength={5}
                          value={option.distractor_analysis}
                          onChange={(e) => {
                            setOptions((rows) =>
                              rows.map((o, i) =>
                                i === index
                                  ? {
                                      ...o,
                                      distractor_analysis: e.target.value,
                                    }
                                  : o,
                              ),
                            );
                            setShowPreview(false);
                          }}
                        />
                      </label>
                    )}
                  </fieldset>
                ))}
            </fieldset>
            {editable && (
              <button disabled={busy || preview}>
                {showPreview
                  ? 'Confirmar e salvar rascunho'
                  : 'Validar e visualizar questão'}
              </button>
            )}
          </form>
          {(showPreview || !editable) && (
            <QuestionPreview payload={payload} options={options} />
          )}{' '}
          {id && (
            <section>
              <h4>Imagens privadas</h4>
              <p>
                Para substituir, envie a nova imagem e remova a anterior do
                rascunho.
              </p>
              {editable && (
                <label>
                  Adicionar imagem (até 5 MB)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy || preview}
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                </label>
              )}
              {images.map((image) => (
                <figure key={image.path}>
                  <img src={image.url} alt="Imagem de apoio da questão" />
                  {editable && (
                    <button
                      disabled={busy}
                      onClick={() => void removeImage(image.path)}
                    >
                      Remover imagem
                    </button>
                  )}
                </figure>
              ))}
              {!images.length && <p>Sem imagens.</p>}
            </section>
          )}
          {item?.status === 'approved' && (
            <button disabled={busy || preview} onClick={() => void revise()}>
              Criar novo rascunho a partir do aprovado
            </button>
          )}
          {!!versions.length && (
            <section>
              <h4>Comparação de versões (até 100 mais recentes)</h4>
              <div className="phase12-grid">
                <label>
                  Versão anterior
                  <select
                    value={left}
                    onChange={(e) => setLeft(e.target.value)}
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        Versão {v.version_number}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Versão seguinte
                  <select
                    value={right}
                    onChange={(e) => setRight(e.target.value)}
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        Versão {v.version_number}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="phase12-version-grid">
                {[left, right].map((value, index) => (
                  <section key={index}>
                    <h4>
                      Versão{' '}
                      {versions.find((v) => v.id === value)?.version_number}
                    </h4>
                    {[
                      'statement',
                      'support_text',
                      'options',
                      'correct_answer_justification',
                      'pedagogical_comment',
                      'skill_id',
                      'difficulty',
                      'formula',
                      'image_paths',
                    ].map((key) => (
                      <div key={key}>
                        <strong>
                          {
                            (
                              {
                                statement: 'Enunciado',
                                support_text: 'Texto de apoio',
                                options: 'Alternativas e resposta correta',
                                correct_answer_justification: 'Justificativa',
                                pedagogical_comment: 'Comentário pedagógico',
                                skill_id: 'Habilidade (identificador)',
                                difficulty: 'Dificuldade',
                                formula: 'Fórmula',
                                image_paths: 'Imagens',
                              } as Record<string, string>
                            )[key]
                          }
                        </strong>
                        <pre>
                          {JSON.stringify(
                            versions.find((v) => v.id === value)?.snapshot[
                              key
                            ] ?? null,
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            </section>
          )}
          <h4>Timeline editorial</h4>
          {history.length ? (
            history.map((h, i) => (
              <p key={i}>
                {new Date(h.created_at).toLocaleString('pt-BR')} ·{' '}
                {(
                  {
                    submitted: 'Enviado',
                    returned: 'Devolvido',
                    reviewed: 'Revisado',
                    approved: 'Aprovado',
                    rejected: 'Rejeitado',
                    archived: 'Arquivado',
                  } as Record<string, string>
                )[h.action] ?? h.action}{' '}
                · responsável {h.actor_name || 'Usuário indisponível'}
                <br />
                {h.comment ?? 'Sem comentário'}
              </p>
            ))
          ) : (
            <p>Nenhuma transição registrada.</p>
          )}
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
