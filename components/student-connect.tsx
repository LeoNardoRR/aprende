'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  LoaderCircle,
  LogOut,
  School,
  Send,
  Trophy,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { studentSupabase as supabase } from '@/lib/supabase';
import {
  calculateConnectedMetrics,
  canEditSubmission,
  connectedSubmissionLabel,
  friendlySupabaseError,
  normalizeClassCode,
} from '@/lib/connected-flow';

type Profile = {
  id: string;
  display_name: string;
  role: 'teacher' | 'student';
};
type Classroom = { id: string; name: string; subject: string };
type Membership = { classroom_id: string; classrooms: Classroom | null };
type Assignment = {
  id: string;
  classroom_id: string;
  title: string;
  subject: string;
  instructions: string;
  due_at: string | null;
  points: number;
  created_at: string;
};
type Submission = {
  id: string;
  assignment_id: string;
  answer: string;
  status: 'draft' | 'submitted';
  score: number | null;
  feedback: string | null;
};
type Announcement = {
  id: string;
  classroom_id: string;
  message: string;
  created_at: string;
};
const PENDING_CLASS_CODE = 'aprende-pending-class-code';

function authReturnUrl() {
  return window.location.hostname === 'localhost'
    ? 'http://localhost:3000/?auth=student'
    : 'https://leonardorr.github.io/aprende/?auth=student';
}

type StudentConnectProps = {
  onClose: () => void;
  allowClose?: boolean;
  pageMode?: boolean;
  onOpenTeacher?: () => void;
  onChanged?: () => void | Promise<void>;
};

export function StudentConnect({
  onClose,
  allowClose = true,
  pageMode = false,
  onOpenTeacher,
  onChanged,
}: StudentConnectProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    code: '',
  });
  const [notice, setNotice] = useState('');
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(
    null,
  );
  const [answer, setAnswer] = useState('');

  const loadStudent = useCallback(
    async (activeSession: Session | null, successNotice?: string) => {
      if (!activeSession) {
        setProfile(null);
        setMemberships([]);
        setAssignments([]);
        setSubmissions([]);
        setAnnouncements([]);
        setLoading(false);
        void onChanged?.();
        return;
      }
      setLoading(true);
      const profileResult = await supabase
        .from('profiles')
        .select('id,display_name,role')
        .eq('id', activeSession.user.id)
        .single();
      const nextProfile = profileResult.data as Profile | null;
      setProfile(nextProfile);
      if (nextProfile?.role === 'student') {
        let joinNotice = '';
        const pendingCode = localStorage.getItem(PENDING_CLASS_CODE);
        if (pendingCode) {
          // The code is a one-shot handoff from login/email confirmation. Keeping
          // an invalid code here would make every later session retry forever.
          localStorage.removeItem(PENDING_CLASS_CODE);
          const { error } = await supabase.rpc('join_class_by_code', {
            code: pendingCode,
          });
          if (error) joinNotice = friendlySupabaseError(error.message);
        }
        const memberResult = await supabase
          .from('memberships')
          .select('classroom_id,classrooms(id,name,subject)')
          .eq('user_id', activeSession.user.id)
          .order('joined_at');
        const nextMemberships = (memberResult.data ??
          []) as unknown as Membership[];
        const classIds = nextMemberships.map((item) => item.classroom_id);
        setMemberships(nextMemberships);
        if (classIds.length) {
          const [assignmentResult, announcementResult] = await Promise.all([
            supabase
              .from('assignments')
              .select('*')
              .in('classroom_id', classIds)
              .order('created_at', { ascending: false }),
            supabase
              .from('announcements')
              .select('*')
              .in('classroom_id', classIds)
              .order('created_at', { ascending: false }),
          ]);
          const nextAssignments = (assignmentResult.data ?? []) as Assignment[];
          setAssignments(nextAssignments);
          setAnnouncements((announcementResult.data ?? []) as Announcement[]);
          if (nextAssignments.length) {
            const submissionResult = await supabase
              .from('submissions')
              .select('id,assignment_id,answer,status,score,feedback')
              .in(
                'assignment_id',
                nextAssignments.map((item) => item.id),
              );
            setSubmissions((submissionResult.data ?? []) as Submission[]);
            const loadError =
              memberResult.error ||
              assignmentResult.error ||
              announcementResult.error ||
              submissionResult.error;
            setNotice(
              successNotice ||
                joinNotice ||
                (loadError ? friendlySupabaseError(loadError.message) : ''),
            );
          } else {
            setSubmissions([]);
            setNotice(
              successNotice ||
                joinNotice ||
                (memberResult.error ||
                assignmentResult.error ||
                announcementResult.error
                  ? friendlySupabaseError(
                      (memberResult.error ||
                        assignmentResult.error ||
                        announcementResult.error)!.message,
                    )
                  : ''),
            );
          }
        } else {
          setAssignments([]);
          setSubmissions([]);
          setAnnouncements([]);
          setNotice(
            successNotice ||
              joinNotice ||
              (memberResult.error
                ? friendlySupabaseError(memberResult.error.message)
                : ''),
          );
        }
      } else {
        setMemberships([]);
        setAssignments([]);
        setSubmissions([]);
        setAnnouncements([]);
        setNotice(
          profileResult.error
            ? friendlySupabaseError(profileResult.error.message)
            : '',
        );
      }
      setLoading(false);
      void onChanged?.();
    },
    [onChanged],
  );

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadStudent(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadStudent(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, [loadStudent]);

  const metrics = useMemo(
    () => calculateConnectedMetrics(assignments, submissions),
    [assignments, submissions],
  );
  const activeSubmission = activeAssignment
    ? submissions.find((item) => item.assignment_id === activeAssignment.id)
    : undefined;
  const activeAssignmentLocked = !canEditSubmission(activeSubmission);

  async function authenticate(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    if (form.code)
      localStorage.setItem(PENDING_CLASS_CODE, form.code.trim().toUpperCase());
    const result = creating
      ? await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: { display_name: form.name.trim() },
            emailRedirectTo: authReturnUrl(),
          },
        })
      : await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
    setBusy(false);
    if (result.error) {
      localStorage.removeItem(PENDING_CLASS_CODE);
      setNotice(friendlySupabaseError(result.error.message));
    } else if (creating && !result.data.session)
      setNotice(
        'Enviamos um e-mail de confirmação. Abra o link para ativar sua conta e voltar ao Aprendê.',
      );
  }

  async function joinClass(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    const { data: classroomId, error } = await supabase.rpc(
      'join_class_by_code',
      {
        code: form.code.trim().toUpperCase(),
      },
    );
    if (error) setNotice(friendlySupabaseError(error.message));
    else {
      const alreadyJoined = memberships.some(
        (membership) => membership.classroom_id === classroomId,
      );
      setForm((current) => ({ ...current, code: '' }));
      await loadStudent(
        session,
        alreadyJoined
          ? 'Você já participa desta turma.'
          : 'Tudo certo! Você entrou na turma.',
      );
    }
    setBusy(false);
  }

  function openAssignment(item: Assignment) {
    setActiveAssignment(item);
    setAnswer(
      submissions.find((submission) => submission.assignment_id === item.id)
        ?.answer ?? '',
    );
  }

  async function saveAssignment(status: 'draft' | 'submitted') {
    if (!session || !activeAssignment || !answer.trim()) return;
    setBusy(true);
    setNotice('');
    const existing = submissions.find(
      (item) => item.assignment_id === activeAssignment.id,
    );
    if (!canEditSubmission(existing)) {
      setBusy(false);
      setNotice(
        'Esta atividade já foi corrigida e não pode mais ser alterada.',
      );
      return;
    }
    const payload = {
      answer: answer.trim(),
      status,
      submitted_at: status === 'submitted' ? new Date().toISOString() : null,
    };
    const { error } = existing
      ? await supabase
          .from('submissions')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      : await supabase.from('submissions').insert({
          assignment_id: activeAssignment.id,
          student_id: session.user.id,
          ...payload,
        });
    setBusy(false);
    if (error) setNotice(friendlySupabaseError(error.message));
    else {
      const successMessage =
        status === 'submitted'
          ? 'Atividade enviada ao professor.'
          : 'Rascunho salvo.';
      setActiveAssignment(null);
      await loadStudent(session, successMessage);
    }
  }

  async function leaveClass(classroomId: string, classroomName: string) {
    if (
      !session ||
      !window.confirm(
        `Sair da turma ${classroomName}? Você poderá entrar novamente usando o código da turma.`,
      )
    )
      return;
    setBusy(true);
    setNotice('');
    const { error } = await supabase
      .from('memberships')
      .delete()
      .eq('classroom_id', classroomId)
      .eq('user_id', session.user.id);
    if (error) setNotice(friendlySupabaseError(error.message));
    else {
      await loadStudent(session, `Você saiu da turma ${classroomName}.`);
    }
    setBusy(false);
  }

  return (
    <div
      className={pageMode ? 'student-connect-page' : 'student-connect-backdrop'}
      style={
        pageMode
          ? {
              minHeight: '100svh',
              width: '100%',
              padding: 'clamp(0px, 3vw, 28px)',
              boxSizing: 'border-box',
            }
          : undefined
      }
      role="presentation"
      onMouseDown={(event) => {
        if (!pageMode && allowClose && event.target === event.currentTarget)
          onClose();
      }}
    >
      <section
        className="student-connect"
        style={
          pageMode
            ? {
                width: '100%',
                maxWidth: '1080px',
                minHeight: 'calc(100svh - 56px)',
                margin: '0 auto',
                boxSizing: 'border-box',
              }
            : undefined
        }
        role={pageMode ? undefined : 'dialog'}
        aria-modal={pageMode ? undefined : 'true'}
        aria-label="Área do aluno"
      >
        <header>
          <button
            type="button"
            className="teacher-logo"
            aria-label="Recarregar Aprendê"
            onClick={() => window.location.assign('./')}
          >
            <span>
              <GraduationCap size={24} />
            </span>
            <strong>Aprendê</strong>
          </button>
          <div className="student-header-actions">
            {onOpenTeacher && (
              <button
                type="button"
                className="teacher-secondary"
                onClick={onOpenTeacher}
              >
                <School />
                Modo professor
              </button>
            )}
            {allowClose && (
              <button onClick={onClose} aria-label="Fechar">
                <X />
              </button>
            )}
          </div>
        </header>
        {loading ? (
          <div className="portal-loading">
            <LoaderCircle className="spin" />
            <p>Preparando sua conta...</p>
          </div>
        ) : !session ? (
          <div className="student-connect-auth">
            <div>
              <span className="teacher-kicker">SALA CONECTADA</span>
              <h2>{creating ? 'Primeiro acesso' : 'Entre na sua conta'}</h2>
              <p>
                Digite o código enviado pelo professor. No primeiro acesso, ele
                será guardado até você confirmar o e-mail.
              </p>
              {onOpenTeacher && !pageMode && (
                <button
                  type="button"
                  className="teacher-secondary student-teacher-link"
                  onClick={onOpenTeacher}
                >
                  <School />
                  Acessar como professor
                </button>
              )}
            </div>
            <section className="student-login-card">
              <div className="student-auth-tabs">
                <button
                  type="button"
                  className={!creating ? 'active' : ''}
                  onClick={() => {
                    setCreating(false);
                    setNotice('');
                  }}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  className={creating ? 'active' : ''}
                  onClick={() => {
                    setCreating(true);
                    setNotice('');
                  }}
                >
                  Primeiro acesso
                </button>
              </div>
              <form onSubmit={authenticate}>
                {creating && (
                  <label>
                    Seu nome
                    <input
                      required
                      minLength={2}
                      maxLength={80}
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="Como o professor verá você"
                    />
                  </label>
                )}
                <label>
                  Código da turma {creating ? '' : '(opcional)'}
                  <input
                    required={creating}
                    minLength={form.code ? 8 : undefined}
                    maxLength={8}
                    autoCapitalize="characters"
                    value={form.code}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        code: normalizeClassCode(e.target.value),
                      })
                    }
                    placeholder="AB12CD34"
                    className="student-login-code"
                  />
                </label>
                <label>
                  E-mail
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="aluno@exemplo.com"
                  />
                </label>
                <label>
                  Senha
                  <input
                    required
                    minLength={8}
                    type="password"
                    autoComplete={
                      creating ? 'new-password' : 'current-password'
                    }
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    placeholder="No mínimo 8 caracteres"
                  />
                </label>
                {notice && <output className="teacher-notice">{notice}</output>}
                <button className="teacher-primary" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" />
                  ) : creating ? (
                    'Criar conta e entrar na turma'
                  ) : form.code ? (
                    'Entrar na turma'
                  ) : (
                    'Entrar'
                  )}
                </button>
              </form>
            </section>
          </div>
        ) : profile?.role === 'teacher' ? (
          <div className="teacher-message">
            <span>
              <School />
            </span>
            <h1>Esta conta é de professor</h1>
            <p>
              Use o painel do professor ou saia desta conta para entrar como
              aluno.
            </p>
            {onOpenTeacher && (
              <button className="teacher-primary" onClick={onOpenTeacher}>
                <School />
                Abrir painel do professor
              </button>
            )}
            <button
              className="teacher-secondary"
              onClick={() => void supabase.auth.signOut()}
            >
              <LogOut />
              Sair desta conta
            </button>
          </div>
        ) : (
          <div className="student-connect-body">
            <div className="student-session-bar">
              {pageMode ? (
                <strong>Minha sala conectada</strong>
              ) : (
                <button className="student-back" onClick={onClose}>
                  <ArrowLeft />
                  Voltar à sala
                </button>
              )}
              <span>
                {profile?.display_name}
                <button onClick={() => void supabase.auth.signOut()}>
                  <LogOut />
                  Sair
                </button>
              </span>
            </div>
            <div className="student-connect-intro">
              <span>
                <Users />
              </span>
              <div>
                <small>ÁREA CONECTADA</small>
                <h2>Olá, {profile?.display_name.split(' ')[0]}</h2>
                <p>
                  {memberships[0]?.classrooms
                    ? `Acompanhe sua turma ${memberships[0].classrooms.name} · ${memberships[0].classrooms.subject}.`
                    : 'Entre em uma turma e acompanhe tudo que o professor enviou.'}
                </p>
              </div>
            </div>
            {memberships[0]?.classrooms && (
              <div className="student-classroom-banner">
                <BookOpen />
                <div>
                  <small>SALA DE AULA</small>
                  <strong>{memberships[0].classrooms.name}</strong>
                  <span>{memberships[0].classrooms.subject}</span>
                </div>
              </div>
            )}
            <section className="student-score-grid">
              <article>
                <Trophy />
                <div>
                  <strong>
                    {metrics.earned} de {metrics.possible}
                  </strong>
                  <small>pontos conquistados</small>
                </div>
              </article>
              <article>
                <CheckCircle2 />
                <div>
                  <strong>
                    {metrics.delivered} de {metrics.total}
                  </strong>
                  <small>atividades entregues</small>
                </div>
              </article>
            </section>
            <form className="student-code-form" onSubmit={joinClass}>
              <label htmlFor="class-code">Código da turma</label>
              <div>
                <input
                  id="class-code"
                  required
                  minLength={8}
                  maxLength={8}
                  autoCapitalize="characters"
                  value={form.code}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      code: normalizeClassCode(e.target.value),
                    })
                  }
                  placeholder="AB12CD34"
                />
                <button className="teacher-primary" disabled={busy}>
                  {busy ? <LoaderCircle className="spin" /> : 'Entrar na turma'}
                </button>
              </div>
            </form>
            {notice && <output className="teacher-notice">{notice}</output>}
            <section className="student-feed">
              <div>
                <h3>
                  <Bell />
                  Recados
                </h3>
                <span>{announcements.length}</span>
              </div>
              {announcements.length ? (
                announcements.map((item) => (
                  <article key={item.id}>
                    <p>{item.message}</p>
                    <small>
                      {
                        memberships.find(
                          (member) => member.classroom_id === item.classroom_id,
                        )?.classrooms?.name
                      }{' '}
                      · {new Date(item.created_at).toLocaleDateString('pt-BR')}
                    </small>
                  </article>
                ))
              ) : (
                <p className="student-empty">Nenhum recado novo.</p>
              )}
            </section>
            <section className="student-feed">
              <div>
                <h3>
                  <BookOpen />
                  Atividades do professor
                </h3>
                <span>{assignments.length}</span>
              </div>
              {assignments.length ? (
                assignments.map((item) => {
                  const submission = submissions.find(
                    (current) => current.assignment_id === item.id,
                  );
                  return (
                    <button
                      className="student-assignment"
                      key={item.id}
                      onClick={() => openAssignment(item)}
                    >
                      <span>
                        <strong>{item.title}</strong>
                        <small>
                          {item.subject} · {item.points} pontos
                          {item.due_at
                            ? ` · até ${new Date(item.due_at).toLocaleDateString('pt-BR')}`
                            : ''}
                        </small>
                      </span>
                      <em className={submission?.status ?? 'pending'}>
                        {submission?.score != null
                          ? `${submission.score}/${item.points}`
                          : connectedSubmissionLabel(submission) === 'Enviada'
                            ? 'Entregue'
                            : connectedSubmissionLabel(submission) ===
                                'Aguardando sua resposta'
                              ? 'Fazer'
                              : connectedSubmissionLabel(submission)}
                      </em>
                    </button>
                  );
                })
              ) : (
                <p className="student-empty">
                  As atividades enviadas aparecerão aqui.
                </p>
              )}
            </section>
            <section className="student-classes">
              <div>
                <h3>Minhas turmas</h3>
                <span>{memberships.length}</span>
              </div>
              {memberships.length ? (
                memberships.map((item) => (
                  <article key={item.classroom_id}>
                    <span>
                      <BookOpen />
                    </span>
                    <div>
                      <strong>{item.classrooms?.name}</strong>
                      <small>{item.classrooms?.subject}</small>
                    </div>
                    <CheckCircle2 />
                    <button
                      type="button"
                      className="student-leave-class"
                      disabled={busy}
                      onClick={() =>
                        leaveClass(
                          item.classroom_id,
                          item.classrooms?.name ?? 'esta turma',
                        )
                      }
                    >
                      <UserMinus size={16} />
                      Sair
                    </button>
                  </article>
                ))
              ) : (
                <p>Você ainda não entrou em nenhuma turma.</p>
              )}
            </section>
          </div>
        )}
        {activeAssignment && (
          <div className="student-task-backdrop">
            <section className="student-task">
              <div>
                <span>
                  <BookOpen />
                </span>
                <button
                  type="button"
                  onClick={() => setActiveAssignment(null)}
                  aria-label="Fechar"
                >
                  <X />
                </button>
              </div>
              <small>
                {activeAssignment.subject} · {activeAssignment.points} pontos
              </small>
              <h2>{activeAssignment.title}</h2>
              <p>
                {activeAssignment.instructions ||
                  'O professor não adicionou orientações.'}
              </p>
              <label>
                Sua resposta
                <textarea
                  required
                  rows={7}
                  maxLength={12000}
                  value={answer}
                  readOnly={activeAssignmentLocked}
                  aria-readonly={activeAssignmentLocked}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Escreva sua resposta aqui..."
                />
              </label>
              {activeAssignmentLocked && (
                <p className="student-task-locked">
                  <CheckCircle2 />
                  {activeSubmission?.score != null
                    ? 'Atividade corrigida. A resposta está bloqueada para preservar a nota.'
                    : 'Atividade enviada. A resposta está bloqueada enquanto aguarda a correção.'}
                </p>
              )}
              {activeSubmission?.feedback && (
                <div className="student-feedback">
                  <strong>Comentário do professor</strong>
                  <p>{activeSubmission.feedback}</p>
                </div>
              )}
              <div className="student-task-actions">
                {activeAssignmentLocked ? (
                  <button
                    type="button"
                    className="teacher-primary"
                    onClick={() => setActiveAssignment(null)}
                  >
                    Fechar
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="teacher-secondary"
                      disabled={busy || !answer.trim()}
                      onClick={() => saveAssignment('draft')}
                    >
                      Salvar rascunho
                    </button>
                    <button
                      type="button"
                      className="teacher-primary"
                      disabled={busy || !answer.trim()}
                      onClick={() => saveAssignment('submitted')}
                    >
                      <Send />
                      Enviar ao professor
                    </button>
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
