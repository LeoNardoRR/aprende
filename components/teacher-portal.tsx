'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileCheck2,
  FileText,
  FileUp,
  Folder,
  GraduationCap,
  ImageUp,
  LoaderCircle,
  LogOut,
  MessageSquare,
  NotebookPen,
  Palette,
  Pencil,
  Plus,
  School,
  UserMinus,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  calculateConnectedProgress,
  friendlySupabaseError,
} from '@/lib/connected-flow';
import {
  authReturnUrl,
  isEmailConfirmationRequired,
  passwordRecoveryUrl,
} from '@/lib/auth-flow';
import { AccountSettings } from '@/components/account-settings';
import { BrandLogo } from '@/components/brand-logo';

type Profile = {
  id: string;
  display_name: string;
  role: 'teacher' | 'student';
  avatar_url: string | null;
};
type Classroom = {
  id: string;
  name: string;
  subject: string;
  join_code: string;
  created_at: string;
  image_url: string | null;
};
type Assignment = {
  id: string;
  classroom_id: string;
  title: string;
  subject: string;
  kind?: 'task' | 'exam';
  instructions: string;
  due_at: string | null;
  points: number;
  created_at: string;
};
type Membership = {
  classroom_id: string;
  user_id: string;
  profiles: { display_name: string } | null;
};
type Submission = {
  id: string;
  assignment_id: string;
  student_id: string;
  answer: string;
  status: 'draft' | 'submitted';
  score: number | null;
  feedback: string | null;
  profiles: { display_name: string } | null;
};
type LessonRecord = {
  id: string;
  classroom_id: string;
  teacher_id: string;
  lesson_date: string;
  title: string;
  content: string;
  observations: string;
  created_at: string;
};
type LessonMaterial = {
  id: string;
  classroom_id: string;
  teacher_id: string;
  lesson_record_id: string | null;
  title: string;
  file_name: string;
  storage_path: string;
  file_type: string;
  file_size: number;
  source: 'government' | 'teacher';
  created_at: string;
};

function normalizeJoinedProfile(value: unknown): { display_name: string } | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== 'object') return null;
  const record = candidate as Record<string, unknown>;
  return typeof record.display_name === 'string'
    ? { display_name: record.display_name }
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function mergePresence(
  defaults: Record<string, boolean>,
  value: unknown,
): Record<string, boolean> {
  if (!isRecord(value)) return defaults;
  return Object.entries(value).reduce(
    (next, [studentId, present]) => {
      if (studentId in defaults && typeof present === 'boolean') {
        next[studentId] = present;
      }
      return next;
    },
    { ...defaults },
  );
}

type TeacherAppearance = {
  palette:
    | 'ocean'
    | 'violet'
    | 'forest'
    | 'coral'
    | 'rose'
    | 'graphite'
    | 'gold'
    | 'sky';
  font: 'modern' | 'friendly' | 'editorial' | 'geometric';
  banner: 'flow' | 'aurora' | 'sunset' | 'midnight' | 'citrus' | 'lavender';
  background: 'dots' | 'clean' | 'grid' | 'glow';
  cards: 'balanced' | 'soft' | 'straight';
  density: 'comfortable' | 'compact';
};

const defaultTeacherAppearance: TeacherAppearance = {
  palette: 'ocean',
  font: 'modern',
  banner: 'flow',
  background: 'dots',
  cards: 'balanced',
  density: 'comfortable',
};

const teacherPaletteIds: TeacherAppearance['palette'][] = [
  'ocean',
  'violet',
  'forest',
  'coral',
  'rose',
  'graphite',
  'gold',
  'sky',
];
const teacherFontIds: TeacherAppearance['font'][] = [
  'modern',
  'friendly',
  'editorial',
  'geometric',
];
const teacherBannerIds: TeacherAppearance['banner'][] = [
  'flow',
  'aurora',
  'sunset',
  'midnight',
  'citrus',
  'lavender',
];
const teacherBackgroundIds: TeacherAppearance['background'][] = [
  'dots',
  'clean',
  'grid',
  'glow',
];
const teacherCardIds: TeacherAppearance['cards'][] = [
  'balanced',
  'soft',
  'straight',
];
const teacherDensityIds: TeacherAppearance['density'][] = [
  'comfortable',
  'compact',
];

export function TeacherPortal({ onClose }: { onClose: () => void }) {
  const previewMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('qa') ===
      'teacher-dashboard';
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (previewMode) {
      setLoading(false);
      return;
    }
    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => {
        setMessage('Não foi possível verificar sua sessão. Tente novamente.');
        setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) =>
      setSession(nextSession),
    );
    return () => data.subscription.unsubscribe();
  }, [previewMode]);

  useEffect(() => {
    if (previewMode) return;
    let active = true;
    async function readProfile() {
      if (!session) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id,display_name,role,avatar_url')
        .eq('id', session.user.id)
        .single();
      if (!active) return;
      setProfile(data);
      setMessage(error?.message ?? '');
      setLoading(false);
    }
    void readProfile();
    return () => {
      active = false;
    };
  }, [previewMode, session]);

  if (previewMode)
    return (
      <TeacherDashboard
        profile={{
          id: 'preview-teacher',
          display_name: 'Professor Gabriel',
          role: 'teacher',
          avatar_url: null,
        }}
        preview
      />
    );

  if (loading)
    return (
      <PortalShell onClose={onClose}>
        <div className="portal-loading">
          <LoaderCircle className="spin" />
          <p>Preparando sua área...</p>
        </div>
      </PortalShell>
    );
  if (!session)
    return (
      <PortalShell onClose={onClose}>
        <TeacherAuth />
      </PortalShell>
    );
  if (!profile)
    return (
      <PortalShell onClose={onClose}>
        <PortalMessage
          title="Não foi possível abrir o perfil"
          text={message || 'Tente entrar novamente.'}
        />
      </PortalShell>
    );
  if (profile.role !== 'teacher')
    return (
      <PortalShell onClose={onClose}>
        <PortalMessage
          title="Esta conta é de aluno"
          text="Entre com um perfil de professor para acessar turmas, atividades e entregas."
          action={
            <button
              className="teacher-secondary"
              onClick={() => void supabase.auth.signOut()}
            >
              Sair desta conta
            </button>
          }
        />
      </PortalShell>
    );
  return <TeacherDashboard profile={profile} />;
}

function PortalShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="teacher-portal">
      <header className="teacher-public-header">
        <button
          type="button"
          className="teacher-logo"
          aria-label="Recarregar Aprendê"
          onClick={() => window.location.assign('./')}
        >
          <span className="brand-mark-shell">
            <BrandLogo variant="teacher" />
          </span>
          <strong>Aprendê</strong>
        </button>
        <button className="teacher-back" onClick={onClose}>
          <ArrowLeft size={17} /> Voltar
        </button>
      </header>
      {children}
    </div>
  );
}

function TeacherAuth() {
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [notice, setNotice] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    setConfirmationEmail('');
    const email = form.email.trim().toLowerCase();
    if (creating) {
      const allowed = await supabase.rpc('is_teacher_email_allowed', {
        target_email: email,
      });
      if (allowed.error) {
        setNotice(friendlySupabaseError(allowed.error.message));
        setBusy(false);
        return;
      }
      if (!allowed.data) {
        setNotice(
          'Este e-mail ainda não foi autorizado para o modo professor. Peça ao administrador para adicioná-lo antes do cadastro.',
        );
        setBusy(false);
        return;
      }
      const result = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: { display_name: form.name.trim() },
          emailRedirectTo: authReturnUrl('teacher'),
        },
      });
      setBusy(false);
      if (result.error) {
        setNotice(friendlySupabaseError(result.error.message));
        if (isEmailConfirmationRequired(result.error.message))
          setConfirmationEmail(email);
      } else if (!result.data.session)
        setNotice(
          'Enviamos um e-mail de confirmação. Abra o link para ativar sua conta e voltar ao Aprendê.',
        );
      return;
    }
    const result = await supabase.auth.signInWithPassword({
      email,
      password: form.password,
    });
    setBusy(false);
    if (result.error) {
      setNotice(friendlySupabaseError(result.error.message));
      if (isEmailConfirmationRequired(result.error.message))
        setConfirmationEmail(email);
    }
  }
  async function resendConfirmation() {
    if (!confirmationEmail) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: confirmationEmail,
      options: { emailRedirectTo: authReturnUrl('teacher') },
    });
    setBusy(false);
    setNotice(
      error
        ? friendlySupabaseError(error.message)
        : 'Enviamos um novo link de confirmação para seu e-mail.',
    );
  }
  async function requestPasswordReset() {
    const email = form.email.trim().toLowerCase();
    if (!email) {
      setNotice('Digite seu e-mail para receber o link de recuperação.');
      return;
    }
    setBusy(true);
    setNotice('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwordRecoveryUrl('teacher'),
    });
    setBusy(false);
    setNotice(
      error
        ? friendlySupabaseError(error.message)
        : 'Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha.',
    );
  }
  return (
    <main className="teacher-auth">
      <section className="teacher-auth-copy">
        <span className="teacher-kicker">MODO PROFESSOR</span>
        <h1>Sua turma em um só lugar.</h1>
        <p>
          Crie turmas e atividades, acompanhe quem entregou e organize o próximo
          passo de cada aluno.
        </p>
        <div className="teacher-benefits">
          <span>
            <Users />
            Turmas conectadas
          </span>
          <span>
            <ClipboardCheck />
            Entregas e notas
          </span>
          <span>
            <CalendarDays />
            Prazos organizados
          </span>
        </div>
      </section>
      <section className="teacher-auth-card">
        <div>
          <span className="teacher-card-icon">
            <School />
          </span>
          <h2>{creating ? 'Primeiro acesso' : 'Entrar como professor'}</h2>
          <p>
            {creating
              ? 'Use o e-mail autorizado para criar seu perfil.'
              : 'Sua sessão continuará ativa neste navegador.'}
          </p>
        </div>
        <div className="student-auth-tabs">
          <button
            type="button"
            className={!creating ? 'active' : ''}
            onClick={() => {
              setCreating(false);
              setNotice('');
              setConfirmationEmail('');
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
              setConfirmationEmail('');
            }}
          >
            Primeiro acesso
          </button>
        </div>
        <form onSubmit={submit}>
          {creating && (
            <label>
              Seu nome
              <input
                required
                minLength={2}
                maxLength={80}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Como os alunos verão você"
              />
            </label>
          )}
          <label>
            E-mail
            <input
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="professor@exemplo.com"
            />
          </label>
          <label>
            Senha
            <input
              required
              minLength={8}
              type="password"
              autoComplete={creating ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="No mínimo 8 caracteres"
            />
          </label>
          {!creating && (
            <button
              type="button"
              className="forgot-password-button"
              disabled={busy}
              onClick={() => void requestPasswordReset()}
            >
              Esqueci minha senha
            </button>
          )}
          {notice && <output className="teacher-notice">{notice}</output>}
          {confirmationEmail && (
            <button
              type="button"
              className="teacher-secondary auth-resend-button"
              disabled={busy}
              onClick={() => void resendConfirmation()}
            >
              Reenviar confirmação
            </button>
          )}
          <button className="teacher-primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" />
            ) : creating ? (
              'Criar conta de professor'
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </section>
    </main>
  );
}

const teacherPreviewClasses: Classroom[] = [
  {
    id: '6a',
    name: '6º A',
    subject: 'Ensino Fundamental II',
    join_code: '6A2026',
    created_at: '',
    image_url: null,
  },
  {
    id: '6b',
    name: '6º B',
    subject: 'Ensino Fundamental II',
    join_code: '6B2026',
    created_at: '',
    image_url: null,
  },
  {
    id: '7a',
    name: '7º A',
    subject: 'Ensino Fundamental II',
    join_code: '7A2026',
    created_at: '',
    image_url: null,
  },
  {
    id: '8a',
    name: '8º A',
    subject: 'Ensino Fundamental II',
    join_code: '8A2026',
    created_at: '',
    image_url: null,
  },
];
const teacherPreviewStudents: Membership[] = [
  'Ana Beatriz Silva',
  'Bruno Oliveira',
  'Carla Mendes',
  'Daniel Costa',
  'Eduarda Lima',
  'Felipe Rodrigues',
].map((display_name, index) => ({
  classroom_id: '6a',
  user_id: `student-${index}`,
  profiles: { display_name },
}));
const teacherPreviewAssignments: Assignment[] = [
  {
    id: 'a1',
    classroom_id: '6a',
    title: 'Leitura e resumo do texto',
    subject: 'Português',
    instructions: 'Ler o texto em sala e preparar um resumo.',
    due_at: '2026-09-12',
    points: 10,
    created_at: '',
  },
  {
    id: 'a2',
    classroom_id: '6a',
    title: 'Exercícios de gramática',
    subject: 'Português',
    instructions: 'Resolver os exercícios indicados.',
    due_at: '2026-09-15',
    points: 20,
    created_at: '',
  },
  {
    id: 'a3',
    classroom_id: '6a',
    title: 'Produção de texto',
    subject: 'Português',
    instructions: 'Escrever um pequeno texto sobre sua rotina.',
    due_at: '2026-09-18',
    points: 20,
    created_at: '',
  },
];
const teacherPreviewLessonRecords: LessonRecord[] = [
  {
    id: 'lesson-preview-1',
    classroom_id: '6a',
    teacher_id: 'teacher-preview',
    lesson_date: new Date().toLocaleDateString('en-CA'),
    title: 'Leitura e interpretação de texto',
    content:
      'Leitura guiada do texto, identificação das ideias principais e atividade em duplas para produção de um resumo.',
    observations:
      'A turma participou bem. Retomar inferência textual na próxima aula.',
    created_at: new Date().toISOString(),
  },
];
const teacherPreviewLessonMaterials: LessonMaterial[] = [
  {
    id: 'material-preview-1',
    classroom_id: '6a',
    teacher_id: 'teacher-preview',
    lesson_record_id: 'lesson-preview-1',
    title: 'Leitura e interpretação - material oficial',
    file_name: 'aula-leitura-interpretacao.pdf',
    storage_path: 'preview/aula-leitura-interpretacao.pdf',
    file_type: 'application/pdf',
    file_size: 1860000,
    source: 'government',
    created_at: new Date().toISOString(),
  },
];

function TeacherDashboard({
  profile,
  preview = false,
}: {
  profile: Profile;
  preview?: boolean;
}) {
  const [classes, setClasses] = useState<Classroom[]>(
    preview ? teacherPreviewClasses : [],
  );
  const [assignments, setAssignments] = useState<Assignment[]>(
    preview ? teacherPreviewAssignments : [],
  );
  const [memberships, setMemberships] = useState<Membership[]>(
    preview ? teacherPreviewStudents : [],
  );
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>(
    preview ? teacherPreviewLessonRecords : [],
  );
  const [lessonMaterials, setLessonMaterials] = useState<LessonMaterial[]>(
    preview ? teacherPreviewLessonMaterials : [],
  );
  const [selected, setSelected] = useState<string>(preview ? '6a' : '');
  const [view, setView] = useState<
    'overview' | 'activities' | 'exams' | 'students' | 'grades'
  >('overview');
  const [busy, setBusy] = useState(!preview);
  const [notice, setNotice] = useState('');
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [showClassForm, setShowClassForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityKind, setActivityKind] = useState<'task' | 'exam'>('task');
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [showLessonRecordForm, setShowLessonRecordForm] = useState(false);
  const [showAppearanceForm, setShowAppearanceForm] = useState(false);
  const [showClassSettings, setShowClassSettings] = useState(false);
  const [appearance, setAppearance] = useState<TeacherAppearance>(
    defaultTeacherAppearance,
  );
  const [appearanceDraft, setAppearanceDraft] = useState<TeacherAppearance>(
    defaultTeacherAppearance,
  );
  const [grading, setGrading] = useState<Submission | null>(null);
  const [removingStudent, setRemovingStudent] = useState<Membership | null>(
    null,
  );

  const refresh = useCallback(
    async (successNotice?: string) => {
      if (preview) {
        if (successNotice) setNotice(successNotice);
        setBusy(false);
        return;
      }
      setBusy(true);
      const classResult = await supabase
        .from('classrooms')
        .select('*')
        .order('created_at');
      let loadError = classResult.error;
      const nextClasses: Classroom[] = classResult.data ?? [];
      setClasses(nextClasses);
      const selectedClassId = nextClasses.some((item) => item.id === selected)
        ? selected
        : nextClasses[0]?.id || '';
      setSelected(selectedClassId);
      if (selectedClassId) {
        const [
          activityResult,
          memberResult,
          lessonRecordResult,
          lessonMaterialResult,
        ] =
          await Promise.all([
            supabase
              .from('assignments')
              .select('*')
              .eq('classroom_id', selectedClassId)
              .order('created_at', { ascending: false }),
            supabase
              .from('memberships')
              .select('classroom_id,user_id,profiles(display_name)')
              .eq('classroom_id', selectedClassId),
            supabase
              .from('lesson_records')
              .select('*')
              .eq('classroom_id', selectedClassId)
              .order('lesson_date', { ascending: false })
              .order('created_at', { ascending: false }),
            supabase
              .from('lesson_materials')
              .select('*')
              .eq('classroom_id', selectedClassId)
              .order('created_at', { ascending: false }),
          ]);
        const nextAssignments: Assignment[] = (activityResult.data ?? []).map(
          (item) => ({
            ...item,
            kind: item.kind === 'exam' ? 'exam' : 'task',
          }),
        );
        setAssignments(nextAssignments);
        setMemberships(
          (memberResult.data ?? []).map((item) => ({
            classroom_id: item.classroom_id,
            user_id: item.user_id,
            profiles: normalizeJoinedProfile(item.profiles),
          })),
        );
        setLessonRecords(lessonRecordResult.data ?? []);
        setLessonMaterials(
          (lessonMaterialResult.data ?? []).map((item) => ({
            ...item,
            source: item.source === 'teacher' ? 'teacher' : 'government',
          })),
        );
        loadError =
          loadError ||
          activityResult.error ||
          memberResult.error ||
          lessonRecordResult.error ||
          lessonMaterialResult.error;
        if (lessonRecordResult.error || lessonMaterialResult.error) {
          setNotice(
            'O Registro de aula precisa da atualização mais recente do banco de dados.',
          );
        }
        if (nextAssignments.length) {
          const submissionResult = await supabase
            .from('submissions')
            .select(
              'id,assignment_id,student_id,answer,status,score,feedback,profiles(display_name)',
            )
            .in(
              'assignment_id',
              nextAssignments.map((item) => item.id),
            );
          setSubmissions(
            (submissionResult.data ?? []).map((item) => ({
              id: item.id,
              assignment_id: item.assignment_id,
              student_id: item.student_id,
              answer: item.answer,
              status: item.status,
              score: item.score,
              feedback: item.feedback,
              profiles: normalizeJoinedProfile(item.profiles),
            })),
          );
          loadError = loadError || submissionResult.error;
        } else setSubmissions([]);
      } else {
        setAssignments([]);
        setMemberships([]);
        setSubmissions([]);
        setLessonRecords([]);
        setLessonMaterials([]);
      }
      if (loadError) setNotice(friendlySupabaseError(loadError.message));
      else if (successNotice) setNotice(successNotice);
      setBusy(false);
    },
    [preview, selected],
  );

  useEffect(() => {
    if (preview) return;
    void refresh();
  }, [preview, refresh]);

  useEffect(() => {
    if (preview) return;
    const reloadWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', reloadWhenVisible);
    document.addEventListener('visibilitychange', reloadWhenVisible);
    return () => {
      window.removeEventListener('focus', reloadWhenVisible);
      document.removeEventListener('visibilitychange', reloadWhenVisible);
    };
  }, [preview, refresh]);

  useEffect(() => {
    const saved = window.localStorage.getItem(
      `aprende:teacher-appearance:${profile.id}`,
    );
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Partial<TeacherAppearance>;
      const next: TeacherAppearance = {
        palette: teacherPaletteIds.includes(
          parsed.palette as TeacherAppearance['palette'],
        )
          ? (parsed.palette as TeacherAppearance['palette'])
          : 'ocean',
        font: teacherFontIds.includes(parsed.font as TeacherAppearance['font'])
          ? (parsed.font as TeacherAppearance['font'])
          : 'modern',
        banner: teacherBannerIds.includes(
          parsed.banner as TeacherAppearance['banner'],
        )
          ? (parsed.banner as TeacherAppearance['banner'])
          : 'flow',
        background: teacherBackgroundIds.includes(
          parsed.background as TeacherAppearance['background'],
        )
          ? (parsed.background as TeacherAppearance['background'])
          : 'dots',
        cards: teacherCardIds.includes(
          parsed.cards as TeacherAppearance['cards'],
        )
          ? (parsed.cards as TeacherAppearance['cards'])
          : 'balanced',
        density: teacherDensityIds.includes(
          parsed.density as TeacherAppearance['density'],
        )
          ? (parsed.density as TeacherAppearance['density'])
          : 'comfortable',
      };
      setAppearance(next);
      setAppearanceDraft(next);
    } catch {
      window.localStorage.removeItem(
        `aprende:teacher-appearance:${profile.id}`,
      );
    }
  }, [profile.id]);
  const currentClass = classes.find((item) => item.id === selected);
  const classActivities = assignments.filter(
    (item) => item.classroom_id === selected,
  );
  const taskAssignments = classActivities.filter((item) => item.kind !== 'exam');
  const examAssignments = classActivities.filter((item) => item.kind === 'exam');
  const classStudents = memberships.filter(
    (item) => item.classroom_id === selected,
  );
  const delivered = submissions.filter(
    (item) =>
      classActivities.some((activity) => activity.id === item.assignment_id) &&
      item.status === 'submitted',
  );
  const taskDelivered = delivered.filter((item) =>
    taskAssignments.some((assignment) => assignment.id === item.assignment_id),
  );
  const examDelivered = delivered.filter((item) =>
    examAssignments.some((assignment) => assignment.id === item.assignment_id),
  );
  const classLessonRecords = lessonRecords.filter(
    (item) => item.classroom_id === selected,
  );
  const classLessonMaterials = lessonMaterials.filter(
    (item) => item.classroom_id === selected,
  );
  const today = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  function requestRemoveStudent(member: Membership) {
    setRemovingStudent(member);
  }

  async function openLessonMaterial(material: LessonMaterial) {
    if (preview) {
      setNotice('Na versão publicada, o arquivo será aberto por um link seguro.');
      return;
    }
    const { data, error } = await supabase.storage
      .from('lesson-materials')
      .createSignedUrl(material.storage_path, 60);
    if (error || !data?.signedUrl) {
      setNotice(
        error
          ? friendlySupabaseError(error.message)
          : 'Não foi possível abrir este material.',
      );
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function removeStudent() {
    if (!removingStudent) return;
    const member = removingStudent;
    const studentName = member.profiles?.display_name ?? 'este aluno';
    setBusy(true);
    setNotice('');
    const { error } = await supabase
      .from('memberships')
      .delete()
      .eq('classroom_id', member.classroom_id)
      .eq('user_id', member.user_id);
    if (error) setNotice(friendlySupabaseError(error.message));
    else {
      await refresh(`${studentName} foi removido da turma.`);
    }
    setRemovingStudent(null);
    setBusy(false);
  }

  return (
    <div
      className="teacher-app"
      data-teacher-palette={
        showAppearanceForm ? appearanceDraft.palette : appearance.palette
      }
      data-teacher-font={
        showAppearanceForm ? appearanceDraft.font : appearance.font
      }
      data-teacher-banner={
        showAppearanceForm ? appearanceDraft.banner : appearance.banner
      }
      data-teacher-background={
        showAppearanceForm ? appearanceDraft.background : appearance.background
      }
      data-teacher-cards={
        showAppearanceForm ? appearanceDraft.cards : appearance.cards
      }
      data-teacher-density={
        showAppearanceForm ? appearanceDraft.density : appearance.density
      }
    >
      <aside className="teacher-sidebar">
        <button
          type="button"
          className="teacher-logo"
          aria-label="Abrir visão geral"
          onClick={() => setView('overview')}
        >
          <span className="brand-mark-shell">
            <BrandLogo variant="teacher" />
          </span>
          <strong>Sala do Professor</strong>
        </button>
        <div className="teacher-profile">
          {avatarUrl ? (
            <img src={avatarUrl} alt={`Foto de ${displayName}`} />
          ) : (
            <div>{displayName.slice(0, 1).toUpperCase()}</div>
          )}
          <span>
            <strong>{displayName}</strong>
            <small>Professor</small>
          </span>
        </div>
        <nav>
          <button
            aria-label="Visão geral"
            className={view === 'overview' ? 'active' : ''}
            onClick={() => setView('overview')}
          >
            <School />
            <span>Início</span>
          </button>
          <button
            aria-label="Turmas"
            className={`teacher-mobile-hide ${view === 'students' ? 'active' : ''}`}
            onClick={() => setView('students')}
          >
            <Users />
            <span>Turmas</span>
          </button>
          <button
            aria-label="Provas e avaliações"
            className={`teacher-mobile-hide ${view === 'exams' ? 'active' : ''}`}
            onClick={() => setView('exams')}
          >
            <FileCheck2 />
            <span>Provas</span>
          </button>
          <button
            aria-label="Lançamento de atividades"
            className={`teacher-mobile-hide ${view === 'activities' ? 'active' : ''}`}
            onClick={() => setView('activities')}
          >
            <ClipboardCheck />
            <span>Atividades</span>
          </button>
          <button
            aria-label="Notas"
            className={view === 'grades' ? 'active' : ''}
            onClick={() => setView('grades')}
          >
            <BarChart3 />
            <span>Notas</span>
          </button>
        </nav>
        <AccountSettings
          role="teacher"
          avatarUrl={avatarUrl}
          onAvatarUpdated={setAvatarUrl}
          displayName={displayName}
          onDisplayNameUpdated={setDisplayName}
          preview={preview}
        />
        <button
          className="teacher-exit"
          aria-label="Sair da conta"
          onClick={() => void supabase.auth.signOut()}
        >
          <LogOut />
          <span>Sair</span>
        </button>
      </aside>
      <main className="teacher-main">
        <header className="teacher-topbar">
          <div className="teacher-greeting">
            <h1>Olá, {displayName.replace(/^Professor(a)?\s+/i, '')}!</h1>
            <p>Aqui você gerencia suas turmas.</p>
          </div>
          <div className="teacher-date">
            <CalendarDays />
            <span>
              <strong>{today}</strong>
              <small>
                {new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(
                  new Date(),
                )}
              </small>
            </span>
          </div>
          <div className="teacher-top-actions">
            {currentClass && (
              <button
                className="teacher-secondary teacher-send"
                onClick={() => setShowAnnouncementForm(true)}
              >
                <Bell />
                Enviar recado
              </button>
            )}
            <button
              className="teacher-primary compact teacher-new-class"
              onClick={() => setShowClassForm(true)}
            >
              <Plus />
              Nova turma
            </button>
            <button
              type="button"
              className="teacher-appearance-button"
              aria-label="Personalizar aparência do painel"
              title="Personalizar aparência"
              onClick={() => {
                setAppearanceDraft(appearance);
                setShowAppearanceForm(true);
              }}
            >
              <Palette />
              Aparência
            </button>
          </div>
        </header>
        {notice && <p className="teacher-notice">{notice}</p>}
        {classes.length > 0 && (
          <div
            className="teacher-class-tabs"
            role="tablist"
            aria-label="Suas turmas"
          >
            {classes.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === selected}
                className={item.id === selected ? 'active' : ''}
                onClick={() => {
                  setSelected(item.id);
                  setView('overview');
                }}
              >
                <Folder />
                {item.name}
              </button>
            ))}
          </div>
        )}
        {busy ? (
          <div className="portal-loading">
            <LoaderCircle className="spin" />
            <p>Carregando suas turmas...</p>
          </div>
        ) : !currentClass ? (
          <EmptyTeacher onCreate={() => setShowClassForm(true)} />
        ) : (
          <>
            {view === 'overview' && (
              <>
                <section className="teacher-class-summary">
                  <div>
                    <span
                      className={`teacher-folder-icon ${currentClass.image_url ? 'has-image' : ''}`}
                    >
                      {currentClass.image_url ? (
                        <img src={currentClass.image_url} alt="" />
                      ) : (
                        <Folder />
                      )}
                    </span>
                    <span>
                      <h2>{currentClass.name}</h2>
                      <p>
                        {currentClass.subject} <b>•</b> {classStudents.length}{' '}
                        alunos
                      </p>
                    </span>
                  </div>
                  <div className="teacher-class-summary-actions">
                    <button
                      type="button"
                      className="teacher-edit-class"
                      onClick={() => setShowClassSettings(true)}
                    >
                      <Pencil />
                      <span>Editar sala</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(currentClass.join_code)
                          .then(() => setNotice('Código copiado.'))
                          .catch(() =>
                            setNotice(
                              `Código da turma: ${currentClass.join_code}`,
                            ),
                          );
                      }}
                    >
                      <small>Código da turma</small>
                      <strong>{currentClass.join_code}</strong>
                      <Copy />
                    </button>
                  </div>
                </section>
                <nav
                  className="teacher-module-tabs"
                  aria-label="Ferramentas da turma"
                >
                  <button onClick={() => setView('students')}>
                    <UserRoundCheck />
                    Alunos da turma
                  </button>
                  <button onClick={() => setView('students')}>
                    <Users />
                    Gerenciar turma
                  </button>
                  <button
                    onClick={() => {
                      setView('activities');
                      setActivityKind('task');
                      setShowActivityForm(true);
                    }}
                  >
                    <ClipboardCheck />
                    Lançar atividade
                  </button>
                  <button
                    onClick={() =>
                      document
                        .getElementById('teacher-lesson-register')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                  >
                    <NotebookPen />
                    Registro da aula
                  </button>
                  <button onClick={() => setView('exams')}>
                    <FileCheck2 />
                    Provas e avaliações
                  </button>
                </nav>
                <div className="teacher-workspace-grid">
                  <section className="teacher-panel teacher-roster-panel">
                    <div className="teacher-panel-title">
                      <div>
                        <span>ALUNOS</span>
                        <h2>Lista de chamada</h2>
                      </div>
                      <strong className="teacher-count">
                        {classStudents.length}
                      </strong>
                    </div>
                    <AttendancePanel
                      classroom={currentClass}
                      students={classStudents}
                      profile={profile}
                      preview={preview}
                      compact
                    />
                  </section>
                  <section
                    className="teacher-panel teacher-lesson-panel"
                    id="teacher-lesson-register"
                  >
                    <LessonRegister
                      records={classLessonRecords}
                      materials={classLessonMaterials}
                      onNewRecord={() => setShowLessonRecordForm(true)}
                      onOpenMaterial={(material) =>
                        void openLessonMaterial(material)
                      }
                    />
                  </section>
                </div>
                <section className="teacher-panel teacher-task-table-panel">
                  <div className="teacher-panel-title">
                    <div>
                      <span>PLANEJAMENTO</span>
                      <h2>Tarefas da turma</h2>
                    </div>
                    <button
                      className="teacher-primary compact"
                      onClick={() => {
                        setActivityKind('task');
                        setShowActivityForm(true);
                      }}
                    >
                      <Plus />
                      Nova tarefa
                    </button>
                  </div>
                  <ActivityList
                    activities={taskAssignments}
                    submissions={submissions}
                    students={classStudents.length}
                  />
                </section>
              </>
            )}
            {view === 'activities' && (
              <>
                <section className="teacher-panel">
                  <div className="teacher-panel-title">
                    <div>
                      <span>CONTEÚDO DA TURMA</span>
                      <h2>Atividades</h2>
                    </div>
                    <button
                      className="teacher-primary compact"
                      onClick={() => {
                        setActivityKind('task');
                        setShowActivityForm(true);
                      }}
                    >
                      <Plus />
                      Nova atividade
                    </button>
                  </div>
                  <ActivityList
                    activities={taskAssignments}
                    submissions={submissions}
                    students={classStudents.length}
                  />
                </section>
                <section className="teacher-panel teacher-submissions">
                  <div className="teacher-panel-title">
                    <div>
                      <span>CORREÇÃO</span>
                      <h2>Entregas recebidas</h2>
                    </div>
                    <strong className="teacher-count">
                      {taskDelivered.length}
                    </strong>
                  </div>
                  <SubmissionList
                    submissions={taskDelivered}
                    assignments={taskAssignments}
                    onGrade={setGrading}
                  />
                </section>
              </>
            )}
            {view === 'exams' && (
              <section className="teacher-panel teacher-submissions">
                <div className="teacher-panel-title">
                  <div>
                    <span>PROVAS E AVALIAÇÕES</span>
                    <h2>Provas da turma</h2>
                    <button
                      className="teacher-primary"
                      onClick={() => {
                        setActivityKind('exam');
                        setShowActivityForm(true);
                      }}
                    >
                      Publicar avaliação
                    </button>
                  </div>
                  <strong className="teacher-count">{examDelivered.length}</strong>
                </div>
                <SubmissionList
                  submissions={examDelivered}
                  assignments={examAssignments}
                  onGrade={setGrading}
                />
              </section>
            )}
            {view === 'students' && (
              <section className="teacher-panel">
                <div className="teacher-panel-title">
                  <div>
                    <span>TURMA {currentClass.name.toUpperCase()}</span>
                    <h2>Alunos conectados</h2>
                  </div>
                  <strong className="teacher-count">
                    {classStudents.length}
                  </strong>
                </div>
                {classStudents.length ? (
                  <div className="teacher-student-list">
                    {classStudents.map((member) => (
                      <div key={member.user_id}>
                        <span>
                          {member.profiles?.display_name
                            ?.slice(0, 1)
                            .toUpperCase() || 'A'}
                        </span>
                        <strong>
                          {member.profiles?.display_name || 'Aluno'}
                        </strong>
                        <small>
                          {
                            submissions.filter(
                              (item) =>
                                item.student_id === member.user_id &&
                                item.status === 'submitted',
                            ).length
                          }{' '}
                          entregas
                        </small>
                        <button
                          className="teacher-secondary teacher-remove-student"
                          disabled={busy}
                          onClick={() => requestRemoveStudent(member)}
                        >
                          <UserMinus size={16} />
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="teacher-empty-line">
                    Nenhum aluno entrou ainda. Compartilhe o código{' '}
                    <strong>{currentClass.join_code}</strong>.
                  </p>
                )}
              </section>
            )}
            {view === 'grades' && (
              <Gradebook
                students={classStudents}
                assignments={classActivities}
                submissions={submissions}
              />
            )}
          </>
        )}
        {showClassForm && (
          <ClassForm
            profile={profile}
            onClose={() => setShowClassForm(false)}
            onSaved={() => refresh('Turma criada com sucesso.')}
          />
        )}{' '}
        {showActivityForm && currentClass && (
          <ActivityForm
            profile={profile}
            classroom={currentClass}
            initialKind={activityKind}
            onClose={() => setShowActivityForm(false)}
            onSaved={() =>
              refresh(
                activityKind === 'exam'
                  ? 'Prova publicada para a turma.'
                  : 'Atividade publicada para a turma.',
              )
            }
          />
        )}{' '}
        {showAnnouncementForm && currentClass && (
          <AnnouncementForm
            profile={profile}
            classroom={currentClass}
            onClose={() => setShowAnnouncementForm(false)}
            onSaved={() => refresh('Recado enviado para a turma.')}
          />
        )}{' '}
        {showLessonRecordForm && currentClass && (
          <LessonRecordForm
            profile={profile}
            classroom={currentClass}
            preview={preview}
            onClose={() => setShowLessonRecordForm(false)}
            onPreviewSaved={(record, materials) => {
              setLessonRecords((items) => [record, ...items]);
              setLessonMaterials((items) => [...materials, ...items]);
              setShowLessonRecordForm(false);
              setNotice('Registro de aula salvo nesta prévia.');
            }}
            onSaved={() => refresh('Registro de aula salvo com sucesso.')}
          />
        )}{' '}
        {showAppearanceForm && (
          <TeacherAppearanceForm
            value={appearanceDraft}
            onChange={setAppearanceDraft}
            onClose={() => {
              setAppearanceDraft(appearance);
              setShowAppearanceForm(false);
            }}
            onSave={() => {
              setAppearance(appearanceDraft);
              window.localStorage.setItem(
                `aprende:teacher-appearance:${profile.id}`,
                JSON.stringify(appearanceDraft),
              );
              setShowAppearanceForm(false);
              setNotice('Visual do painel atualizado neste dispositivo.');
            }}
          />
        )}{' '}
        {showClassSettings && currentClass && (
          <ClassSettingsForm
            classroom={currentClass}
            profile={profile}
            preview={preview}
            onClose={() => setShowClassSettings(false)}
            onPreviewSaved={(next) => {
              setClasses((items) =>
                items.map((item) => (item.id === next.id ? next : item)),
              );
              setShowClassSettings(false);
              setNotice('Sala atualizada na prévia.');
            }}
            onSaved={() => refresh('Sala atualizada com sucesso.')}
          />
        )}{' '}
        {grading && (
          <GradeForm
            submission={grading}
            assignment={assignments.find(
              (item) => item.id === grading.assignment_id,
            )!}
            onClose={() => setGrading(null)}
            onSaved={() => refresh('Correção publicada para o aluno.')}
          />
        )}
        {removingStudent && (
          <Modal
            title="Remover aluno da turma?"
            onClose={() => {
              if (!busy) setRemovingStudent(null);
            }}
          >
            <p className="teacher-confirm-copy">
              Remover{' '}
              <strong>
                {removingStudent.profiles?.display_name ?? 'este aluno'}
              </strong>{' '}
              de <strong>{currentClass?.name ?? 'esta turma'}</strong>? Ele
              poderá entrar novamente usando o código da turma.
            </p>
            <div className="teacher-modal-actions">
              <button
                type="button"
                className="teacher-secondary"
                disabled={busy}
                onClick={() => setRemovingStudent(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="teacher-danger"
                disabled={busy}
                onClick={() => void removeStudent()}
              >
                {busy ? <LoaderCircle className="spin" /> : 'Remover aluno'}
              </button>
            </div>
          </Modal>
        )}
      </main>
    </div>
  );
}

function TeacherAppearanceForm({
  value,
  onChange,
  onClose,
  onSave,
}: {
  value: TeacherAppearance;
  onChange: (value: TeacherAppearance) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal title="Personalizar painel" onClose={onClose} wide>
      <div className="teacher-appearance-form">
        <p>Escolha um visual confortável para organizar suas turmas.</p>
        <fieldset>
          <legend>Cor principal</legend>
          <div className="teacher-choice-grid teacher-color-choices">
            {(
              [
                ['ocean', 'Azul', '#287ba7'],
                ['violet', 'Violeta', '#7656b7'],
                ['forest', 'Verde', '#287966'],
                ['coral', 'Coral', '#d7613b'],
                ['rose', 'Rosa', '#c24f77'],
                ['graphite', 'Grafite', '#536273'],
                ['gold', 'Dourado', '#b47a18'],
                ['sky', 'Céu', '#2887bc'],
              ] as const
            ).map(([id, label, color]) => (
              <button
                type="button"
                className={value.palette === id ? 'selected' : ''}
                onClick={() => onChange({ ...value, palette: id })}
                key={id}
              >
                <i style={{ background: color }} />
                {label}
                {value.palette === id && <CheckCircle2 />}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Fonte</legend>
          <div className="teacher-choice-grid">
            {(
              [
                ['modern', 'Moderna', 'Aa'],
                ['friendly', 'Leve', 'Aa'],
                ['editorial', 'Clássica', 'Aa'],
                ['geometric', 'Geométrica', 'Aa'],
              ] as const
            ).map(([id, label, sample]) => (
              <button
                type="button"
                data-font={id}
                className={value.font === id ? 'selected' : ''}
                onClick={() => onChange({ ...value, font: id })}
                key={id}
              >
                <b>{sample}</b>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Banner da turma</legend>
          <div className="teacher-choice-grid teacher-banner-choices">
            {(
              [
                ['flow', 'Fluxo'],
                ['aurora', 'Aurora'],
                ['sunset', 'Pôr do sol'],
                ['midnight', 'Meia-noite'],
                ['citrus', 'Cítrico'],
                ['lavender', 'Lavanda'],
              ] as const
            ).map(([id, label]) => (
              <button
                type="button"
                data-banner={id}
                className={value.banner === id ? 'selected' : ''}
                onClick={() => onChange({ ...value, banner: id })}
                key={id}
              >
                <i />
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Fundo do painel</legend>
          <div className="teacher-choice-grid teacher-background-choices">
            {(
              [
                ['dots', 'Pontilhado'],
                ['clean', 'Limpo'],
                ['grid', 'Quadriculado'],
                ['glow', 'Luz suave'],
              ] as const
            ).map(([id, label]) => (
              <button
                type="button"
                data-background={id}
                className={value.background === id ? 'selected' : ''}
                onClick={() => onChange({ ...value, background: id })}
                key={id}
              >
                <i />
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="teacher-appearance-pair">
          <fieldset>
            <legend>Formato dos cartões</legend>
            <div className="teacher-choice-grid teacher-card-choices">
              {(
                [
                  ['balanced', 'Equilibrado'],
                  ['soft', 'Arredondado'],
                  ['straight', 'Reto'],
                ] as const
              ).map(([id, label]) => (
                <button
                  type="button"
                  data-card={id}
                  className={value.cards === id ? 'selected' : ''}
                  onClick={() => onChange({ ...value, cards: id })}
                  key={id}
                >
                  <i />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Espaçamento</legend>
            <div className="teacher-choice-grid teacher-density-choices">
              {(
                [
                  ['comfortable', 'Confortável'],
                  ['compact', 'Compacto'],
                ] as const
              ).map(([id, label]) => (
                <button
                  type="button"
                  className={value.density === id ? 'selected' : ''}
                  onClick={() => onChange({ ...value, density: id })}
                  key={id}
                >
                  <i data-density={id} />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="teacher-modal-actions">
          <button
            type="button"
            className="teacher-secondary"
            onClick={() => onChange(defaultTeacherAppearance)}
          >
            Restaurar padrão
          </button>
          <button type="button" className="teacher-primary" onClick={onSave}>
            Salvar visual
          </button>
        </div>
      </div>
    </Modal>
  );
}

function LessonRegister({
  records,
  materials,
  onNewRecord,
  onOpenMaterial,
}: {
  records: LessonRecord[];
  materials: LessonMaterial[];
  onNewRecord: () => void;
  onOpenMaterial: (material: LessonMaterial) => void;
}) {
  return (
    <div className="teacher-lesson-register">
      <div className="teacher-panel-title">
        <div>
          <span>DOCUMENTAÇÃO PEDAGÓGICA</span>
          <h2>Registro da aula</h2>
        </div>
        <button
          type="button"
          className="teacher-primary compact"
          onClick={onNewRecord}
        >
          <Plus />
          Novo registro
        </button>
      </div>
      <p className="teacher-lesson-intro">
        Registre o que foi trabalhado e mantenha os arquivos da aula reunidos
        com a data correta.
      </p>
      {records.length ? (
        <div className="teacher-lesson-list">
          {records.slice(0, 6).map((record) => {
            const attachments = materials.filter(
              (material) => material.lesson_record_id === record.id,
            );
            return (
              <details key={record.id}>
                <summary>
                  <span className="teacher-lesson-date">
                    <CalendarDays />
                    {new Date(`${record.lesson_date}T12:00:00`).toLocaleDateString(
                      'pt-BR',
                    )}
                  </span>
                  <strong>{record.title}</strong>
                  <small>
                    {attachments.length}{' '}
                    {attachments.length === 1 ? 'arquivo' : 'arquivos'}
                  </small>
                </summary>
                <div className="teacher-lesson-details">
                  <section>
                    <span>O que foi feito</span>
                    <p>{record.content}</p>
                  </section>
                  {record.observations && (
                    <section>
                      <span>Observações</span>
                      <p>{record.observations}</p>
                    </section>
                  )}
                  {attachments.length > 0 && (
                    <div className="teacher-lesson-files">
                      {attachments.map((material) => (
                        <button
                          type="button"
                          key={material.id}
                          onClick={() => onOpenMaterial(material)}
                        >
                          <FileText />
                          <span>
                            <strong>{material.title}</strong>
                            <small>
                              {material.file_name} ·{' '}
                              {formatFileSize(material.file_size)}
                            </small>
                          </span>
                          <Download />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          className="teacher-lesson-empty"
          onClick={onNewRecord}
        >
          <NotebookPen />
          <strong>Registre a primeira aula desta turma</strong>
          <span>Inclua a data, o relato e os arquivos utilizados.</span>
        </button>
      )}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeLessonFileName(name: string) {
  const parts = name.split('.');
  const extension = parts.length > 1 ? `.${parts.pop()!.toLowerCase()}` : '';
  const base = parts
    .join('.')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return `${base || 'arquivo'}${extension}`;
}

function LessonRecordForm({
  profile,
  classroom,
  preview,
  onClose,
  onPreviewSaved,
  onSaved,
}: {
  profile: Profile;
  classroom: Classroom;
  preview: boolean;
  onClose: () => void;
  onPreviewSaved: (
    record: LessonRecord,
    materials: LessonMaterial[],
  ) => void;
  onSaved: () => Promise<void>;
}) {
  const [lessonDate, setLessonDate] = useState(
    new Date().toLocaleDateString('en-CA'),
  );
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [observations, setObservations] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedContent = content.trim();
    const normalizedTitle =
      title.trim() || normalizedContent.split(/\n|[.!?]/)[0].slice(0, 160);
    if (files.some((file) => file.size > 20 * 1024 * 1024)) {
      setNotice('Cada arquivo pode ter no máximo 20 MB.');
      return;
    }
    setBusy(true);
    setNotice('Salvando o registro e os arquivos...');
    const timestamp = new Date().toISOString();
    if (preview) {
      const recordId = `lesson-preview-${Date.now()}`;
      const record: LessonRecord = {
        id: recordId,
        classroom_id: classroom.id,
        teacher_id: profile.id,
        lesson_date: lessonDate,
        title: normalizedTitle,
        content: normalizedContent,
        observations: observations.trim(),
        created_at: timestamp,
      };
      const previewMaterials = files.map((file, index) => ({
        id: `material-preview-${Date.now()}-${index}`,
        classroom_id: classroom.id,
        teacher_id: profile.id,
        lesson_record_id: recordId,
        title: file.name.slice(0, 160),
        file_name: file.name,
        storage_path: `preview/${safeLessonFileName(file.name)}`,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
        source: 'teacher' as const,
        created_at: timestamp,
      }));
      onPreviewSaved(record, previewMaterials);
      return;
    }

    const { data: createdRecord, error: recordError } = await supabase
      .from('lesson_records')
      .insert({
        classroom_id: classroom.id,
        teacher_id: profile.id,
        lesson_date: lessonDate,
        title: normalizedTitle,
        content: normalizedContent,
        observations: observations.trim(),
      })
      .select('*')
      .single();
    if (recordError || !createdRecord) {
      setNotice(
        friendlySupabaseError(
          recordError?.message || 'Não foi possível criar o registro.',
        ),
      );
      setBusy(false);
      return;
    }

    const uploadedPaths: string[] = [];
    for (const file of files) {
      const path = `${classroom.id}/${createdRecord.id}/${crypto.randomUUID()}-${safeLessonFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from('lesson-materials')
        .upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });
      if (uploadError) {
        if (uploadedPaths.length)
          await supabase.storage.from('lesson-materials').remove(uploadedPaths);
        await supabase.from('lesson_records').delete().eq('id', createdRecord.id);
        setNotice(friendlySupabaseError(uploadError.message));
        setBusy(false);
        return;
      }
      uploadedPaths.push(path);
      const { error: materialError } = await supabase
        .from('lesson_materials')
        .insert({
          classroom_id: classroom.id,
          teacher_id: profile.id,
          lesson_record_id: createdRecord.id,
          title: file.name.replace(/\.[^.]+$/, '').slice(0, 160),
          file_name: file.name,
          storage_path: path,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          source: 'teacher',
        });
      if (materialError) {
        await supabase.storage.from('lesson-materials').remove(uploadedPaths);
        await supabase.from('lesson_records').delete().eq('id', createdRecord.id);
        setNotice(friendlySupabaseError(materialError.message));
        setBusy(false);
        return;
      }
    }
    await onSaved();
    onClose();
  }

  return (
    <Modal title="Novo registro da aula" onClose={onClose} wide>
      <form className="teacher-form teacher-lesson-form" onSubmit={submit}>
        <p className="teacher-form-help">
          Este registro ficará salvo em <strong>{classroom.name}</strong> e
          vinculado ao seu login de professor.
        </p>
        <div className="teacher-form-row teacher-lesson-form-heading">
          <label>
            Data da aula
            <input
              required
              type="date"
              value={lessonDate}
              onChange={(event) => setLessonDate(event.target.value)}
            />
          </label>
          <label>
            Título ou tema (opcional)
            <input
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Leitura e interpretação"
            />
          </label>
        </div>
        <label>
          O que foi feito na aula
          <textarea
            required
            minLength={2}
            maxLength={12000}
            rows={7}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Descreva conteúdos, atividades, metodologia e o andamento da aula."
          />
        </label>
        <label>
          Observações para acompanhamento
          <textarea
            maxLength={8000}
            rows={4}
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
            placeholder="Ex.: pontos que precisam ser retomados na próxima aula."
          />
        </label>
        <label className="teacher-lesson-upload">
          <span>
            <FileUp />
            <strong>Anexar arquivos da aula</strong>
            <small>
              PDF, PowerPoint, Word, Pages e outros formatos · até 20 MB cada
            </small>
          </span>
          <input
            type="file"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
        </label>
        {files.length > 0 && (
          <div className="teacher-lesson-selected-files">
            {files.map((file) => (
              <span key={`${file.name}-${file.lastModified}`}>
                <FileText />
                <strong>{file.name}</strong>
                <small>{formatFileSize(file.size)}</small>
              </span>
            ))}
          </div>
        )}
        {notice && <p className="teacher-notice">{notice}</p>}
        <div className="teacher-modal-actions">
          <button type="button" className="teacher-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="teacher-primary"
            disabled={busy}
          >
            {busy ? <LoaderCircle className="spin" /> : <NotebookPen />}
            {busy ? 'Salvando...' : 'Salvar registro da aula'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AttendancePanel({
  classroom,
  students,
  profile,
  preview,
}: {
  classroom: Classroom;
  students: Membership[];
  profile: Profile;
  preview: boolean;
  compact?: boolean;
}) {
  const date = new Date().toLocaleDateString('en-CA');
  const studentKey = students.map((item) => item.user_id).join(',');
  const storageKey = `aprende:attendance:${classroom.id}:${date}`;
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  const [pendingSync, setPendingSync] = useState(false);
  const pendingSyncRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const defaultPresence = Object.fromEntries(
      students.map((item) => [item.user_id, true]),
    );
    let localState: {
      presence: Record<string, boolean>;
      pendingSync: boolean;
    } = { presence: defaultPresence, pendingSync: false };
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isRecord(parsed) && isRecord(parsed.presence)) {
          localState = {
            presence: mergePresence(defaultPresence, parsed.presence),
            pendingSync: parsed.pendingSync === true,
          };
        } else if (isRecord(parsed)) {
          // Keep compatibility with the previous plain presence format.
          localState = {
            presence: mergePresence(defaultPresence, parsed),
            pendingSync: false,
          };
        }
      }
    } catch {
      localState = { presence: defaultPresence, pendingSync: false };
    }
    pendingSyncRef.current = localState.pendingSync;
    setPendingSync(localState.pendingSync);
    setPresence(localState.presence);
    if (localState.pendingSync) {
      setNotice('Há uma chamada salva neste dispositivo aguardando sincronização.');
    }
    if (preview || !students.length) return;
    void supabase
      .from('attendance')
      .select('student_id,present')
      .eq('classroom_id', classroom.id)
      .eq('attendance_date', date)
      .then(({ data, error }) => {
        if (error) {
          setNotice(
            localState.pendingSync
              ? 'Há uma chamada salva neste dispositivo aguardando sincronização.'
              : friendlySupabaseError(error.message),
          );
          return;
        }
        if (localState.pendingSync || pendingSyncRef.current) {
          setNotice('Há uma chamada salva neste dispositivo aguardando sincronização.');
          return;
        }
        setPresence((current) => ({
          ...current,
          ...Object.fromEntries(
            (data ?? []).map((item) => [item.student_id, item.present]),
          ),
        }));
      });
  }, [classroom.id, date, preview, storageKey, studentKey]);

  async function save() {
    if (busy) return;
    setBusy(true);
    setNotice('Salvando chamada...');
    const nextPresence = { ...presence };
    const persist = (nextPendingSync: boolean) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          presence: nextPresence,
          pendingSync: nextPendingSync,
          updatedAt: new Date().toISOString(),
        }),
      );
    };
    try {
      persist(!preview);
    } catch {
      setNotice('Não foi possível salvar a chamada neste dispositivo.');
      setBusy(false);
      return;
    }
    pendingSyncRef.current = !preview;
    setPendingSync(!preview);
    if (preview) {
      setNotice('Chamada salva nesta prévia.');
      pendingSyncRef.current = false;
      setBusy(false);
      return;
    }
    const rows = students.map((student) => ({
      classroom_id: classroom.id,
      student_id: student.user_id,
      attendance_date: date,
      present: nextPresence[student.user_id] ?? true,
      recorded_by: profile.id,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'classroom_id,student_id,attendance_date' });
    if (error) {
      try {
        persist(true);
      } catch {
        // The original local write already succeeded; keep the honest sync state.
      }
      pendingSyncRef.current = true;
      setPendingSync(true);
      setNotice(
        'Não foi possível sincronizar a chamada. Os dados permanecem salvos apenas neste dispositivo. Há uma chamada salva neste dispositivo aguardando sincronização.',
      );
    } else {
      try {
        persist(false);
      } catch {
        // The server is authoritative even if the local status update fails.
      }
      pendingSyncRef.current = false;
      setPendingSync(false);
      setNotice('Chamada salva e sincronizada.');
    }
    setBusy(false);
  }

  return (
    <div className="teacher-attendance">
      <div className="teacher-attendance-head">
        <span>
          <CalendarDays />
          {new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR')}
        </span>
        <button
          type="button"
          className="teacher-primary compact"
          disabled={busy || !students.length}
          onClick={() => void save()}
        >
          {busy ? <LoaderCircle className="spin" /> : 'Salvar chamada'}
        </button>
      </div>
      <div className="teacher-roster-table">
        {students.map((member, index) => {
          const present = presence[member.user_id] ?? true;
          return (
            <button
              type="button"
              key={member.user_id}
              disabled={busy}
              aria-pressed={present}
              aria-label={`${present ? 'Marcar falta para' : 'Marcar presença para'} ${member.profiles?.display_name || 'Aluno'}`}
              onClick={() => {
                if (busy) return;
                setPresence((current) => ({
                  ...current,
                  [member.user_id]: !present,
                }));
              }}
            >
              <small>{String(index + 1).padStart(2, '0')}</small>
              <span
                className={`attendance-checkbox ${present ? 'checked' : 'absent'}`}
                aria-hidden="true"
              >
                {present ? <CheckCircle2 /> : <X />}
              </span>
              <strong>{member.profiles?.display_name || 'Aluno'}</strong>
              <span className={present ? '' : 'absent'}>
                {present ? <CheckCircle2 /> : <X />}
                {present ? 'Presente' : 'Faltou'}
              </span>
            </button>
          );
        })}
        {!students.length && <p>Nenhum aluno conectado.</p>}
      </div>
      {notice && (
        <output className="teacher-attendance-notice">{notice}</output>
      )}
      {pendingSync && !preview && (
        <button
          type="button"
          className="teacher-secondary teacher-attendance-retry"
          disabled={busy || !students.length}
          onClick={() => void save()}
        >
          Tentar sincronizar novamente
        </button>
      )}
    </div>
  );
}

function Gradebook({
  students,
  assignments,
  submissions,
}: {
  students: Membership[];
  assignments: Assignment[];
  submissions: Submission[];
}) {
  return (
    <section className="teacher-panel teacher-gradebook">
      <div className="teacher-panel-title">
        <div>
          <span>FECHAMENTO</span>
          <h2>Notas da turma</h2>
        </div>
        <strong className="teacher-count">{students.length}</strong>
      </div>
      {students.length ? (
        <div className="teacher-gradebook-table">
          <div className="teacher-gradebook-row heading">
            <strong>Aluno</strong>
            <span>Atividades</span>
            <span>Pontos avaliados</span>
            <span>Aproveitamento</span>
          </div>
          {students.map((student) => {
            const studentSubmissions = submissions.filter(
              (item) => item.student_id === student.user_id,
            );
            const progress = calculateConnectedProgress(
              assignments,
              studentSubmissions,
            );
            const percentage = progress.percentage ?? 0;
            return (
              <div className="teacher-gradebook-row" key={student.user_id}>
                <strong>{student.profiles?.display_name || 'Aluno'}</strong>
                <span>
                  {progress.submitted}/{progress.total}
                </span>
                <span className="teacher-gradebook-score">
                  {progress.evaluatedPoints
                    ? `${progress.earned}/${progress.evaluatedPoints}`
                    : 'Aguardando'}
                  <small>
                    {progress.totalAvailable} pts disponíveis
                    {progress.pending ? ` · ${progress.pending} pendente${progress.pending === 1 ? '' : 's'}` : ''}
                  </small>
                </span>
                <span>
                  <b style={{ width: `${Math.min(percentage, 100)}%` }} />
                  {progress.percentage == null ? 'Aguardando' : `${progress.percentage}%`}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="teacher-empty-line">Nenhum aluno conectado à turma.</p>
      )}
    </section>
  );
}

function ActivityList({
  activities,
  submissions,
  students,
}: {
  activities: Assignment[];
  submissions: Submission[];
  students: number;
}) {
  if (!activities.length)
    return (
      <p className="teacher-empty-line">
        Crie a primeira atividade para começar a acompanhar a turma.
      </p>
    );
  return (
    <div className="teacher-activity-list">
      {activities.map((item) => {
        const sent = submissions.filter(
          (s) => s.assignment_id === item.id && s.status === 'submitted',
        ).length;
        return (
          <article key={item.id}>
            <span className="teacher-activity-icon">
              <BookOpen />
            </span>
            <div>
              <small>{item.subject}</small>
              <strong>{item.title}</strong>
              <p>
                {item.due_at
                  ? `Entrega até ${new Date(item.due_at).toLocaleDateString('pt-BR')}`
                  : 'Sem prazo definido'}{' '}
                · {item.points} pontos
              </p>
            </div>
            <span className="teacher-delivery">
              <strong>
                {sent}/{students}
              </strong>
              <small>entregas</small>
            </span>
          </article>
        );
      })}
    </div>
  );
}
function SubmissionList({
  submissions,
  assignments,
  onGrade,
}: {
  submissions: Submission[];
  assignments: Assignment[];
  onGrade: (submission: Submission) => void;
}) {
  if (!submissions.length)
    return (
      <p className="teacher-empty-line">
        As respostas enviadas pelos alunos aparecerão aqui.
      </p>
    );
  return (
    <div className="teacher-submission-list">
      {submissions.map((item) => {
        const assignment = assignments.find(
          (current) => current.id === item.assignment_id,
        );
        return (
          <article key={item.id}>
            <div>
              <small>
                {item.profiles?.display_name ?? 'Aluno'} · {assignment?.title}
              </small>
              <p>{item.answer}</p>
            </div>
            <button className="teacher-secondary" onClick={() => onGrade(item)}>
              {item.score == null
                ? 'Corrigir'
                : `${item.score}/${assignment?.points}`}
            </button>
          </article>
        );
      })}
    </div>
  );
}
function EmptyTeacher({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="teacher-empty">
      <span>
        <School />
      </span>
      <h2>Crie sua primeira turma</h2>
      <p>
        Você receberá um código para conectar os alunos e publicar atividades.
      </p>
      <button className="teacher-primary" onClick={onCreate}>
        <Plus />
        Criar turma
      </button>
    </section>
  );
}
function PortalMessage({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <main className="teacher-message">
      <span>
        <GraduationCap />
      </span>
      <h1>{title}</h1>
      <p>{text}</p>
      {action}
    </main>
  );
}

function classroomImagePath(url: string | null) {
  if (!url) return null;
  const marker = '/storage/v1/object/public/classroom-images/';
  const index = url.indexOf(marker);
  if (index < 0) return null;
  return decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
}

async function prepareClassroomImage(file: File) {
  if (!file.type.startsWith('image/'))
    throw new Error('Escolha uma imagem válida.');
  if (file.size > 10 * 1024 * 1024)
    throw new Error('A imagem deve ter no máximo 10 MB.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error('Não foi possível ler esta imagem.'));
      image.src = objectUrl;
    });
    const targetWidth = 960;
    const targetHeight = 540;
    const targetRatio = targetWidth / targetHeight;
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const sourceWidth =
      sourceRatio > targetRatio
        ? image.naturalHeight * targetRatio
        : image.naturalWidth;
    const sourceHeight =
      sourceRatio > targetRatio
        ? image.naturalHeight
        : image.naturalWidth / targetRatio;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a imagem.');
    context.drawImage(
      image,
      (image.naturalWidth - sourceWidth) / 2,
      (image.naturalHeight - sourceHeight) / 2,
      sourceWidth,
      sourceHeight,
      0,
      0,
      targetWidth,
      targetHeight,
    );
    const previewUrl = canvas.toDataURL('image/jpeg', 0.86);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error('Não foi possível salvar a imagem.')),
        'image/jpeg',
        0.86,
      ),
    );
    return { blob, previewUrl };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function ClassSettingsForm({
  classroom,
  profile,
  preview,
  onClose,
  onPreviewSaved,
  onSaved,
}: {
  classroom: Classroom;
  profile: Profile;
  preview: boolean;
  onClose: () => void;
  onPreviewSaved: (classroom: Classroom) => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(classroom.name);
  const [imageUrl, setImageUrl] = useState<string | null>(classroom.image_url);
  const [preparedImage, setPreparedImage] = useState<Blob | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function chooseImage(file: File) {
    setNotice('Preparando imagem...');
    try {
      const prepared = await prepareClassroomImage(file);
      setPreparedImage(prepared.blob);
      setImageUrl(prepared.previewUrl);
      setRemoveImage(false);
      setNotice('Imagem pronta para salvar.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Imagem inválida.');
    }
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setNotice('Digite um nome com pelo menos 2 caracteres.');
      return;
    }
    setBusy(true);
    setNotice('Salvando alterações...');
    if (preview) {
      onPreviewSaved({ ...classroom, name: cleanName, image_url: imageUrl });
      return;
    }
    let nextImageUrl = removeImage ? null : classroom.image_url;
    let uploadedPath: string | null = null;
    try {
      if (preparedImage) {
        uploadedPath = `${profile.id}/${classroom.id}-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('classroom-images')
          .upload(uploadedPath, preparedImage, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
          });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage
          .from('classroom-images')
          .getPublicUrl(uploadedPath);
        nextImageUrl = `${data.publicUrl}?v=${Date.now()}`;
      }
      const { error } = await supabase
        .from('classrooms')
        .update({ name: cleanName, image_url: nextImageUrl })
        .eq('id', classroom.id)
        .eq('owner_id', profile.id);
      if (error) throw error;
      const previousPath = classroomImagePath(classroom.image_url);
      if (previousPath && (preparedImage || removeImage)) {
        void supabase.storage.from('classroom-images').remove([previousPath]);
      }
      onClose();
      await onSaved();
    } catch (error) {
      if (uploadedPath)
        void supabase.storage.from('classroom-images').remove([uploadedPath]);
      setNotice(
        error instanceof Error
          ? friendlySupabaseError(error.message)
          : 'Não foi possível atualizar a sala.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Personalizar sala" onClose={onClose}>
      <form className="teacher-form teacher-class-settings" onSubmit={submit}>
        <div className="teacher-class-image-preview">
          {imageUrl && !removeImage ? (
            <img src={imageUrl} alt="Prévia da imagem da sala" />
          ) : (
            <span>
              <Folder />
              Sua sala
            </span>
          )}
        </div>
        <label>
          Nome da sala
          <input
            value={name}
            minLength={2}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: 6º A"
          />
        </label>
        <div className="teacher-class-image-actions">
          <label className="teacher-secondary">
            <ImageUp />
            Escolher imagem
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void chooseImage(file);
              }}
            />
          </label>
          {imageUrl && !removeImage && (
            <button
              type="button"
              className="teacher-secondary"
              disabled={busy}
              onClick={() => {
                setPreparedImage(null);
                setImageUrl(null);
                setRemoveImage(true);
                setNotice('A imagem será removida ao salvar.');
              }}
            >
              Remover imagem
            </button>
          )}
        </div>
        {notice && <output className="teacher-notice">{notice}</output>}
        <div className="teacher-modal-actions">
          <button type="button" className="teacher-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="teacher-primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" /> : 'Salvar sala'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ClassForm({
  profile,
  onClose,
  onSaved,
}: {
  profile: Profile;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({ name: '', subject: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('classrooms').insert({
      owner_id: profile.id,
      name: form.name.trim(),
      subject: form.subject.trim(),
    });
    setBusy(false);
    if (error) setNotice(friendlySupabaseError(error.message));
    else {
      await onSaved();
      onClose();
    }
  }
  return (
    <Modal title="Nova turma" onClose={onClose}>
      <form className="teacher-form" onSubmit={submit}>
        <label>
          Nome da turma
          <input
            required
            minLength={2}
            maxLength={80}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex.: 7º ano B"
          />
        </label>
        <label>
          Componente curricular
          <input
            required
            minLength={2}
            maxLength={80}
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Ex.: Matemática"
          />
        </label>
        {notice && <p className="teacher-notice">{notice}</p>}
        <button className="teacher-primary" disabled={busy}>
          {busy ? <LoaderCircle className="spin" /> : 'Criar turma'}
        </button>
      </form>
    </Modal>
  );
}
function ActivityForm({
  profile,
  classroom,
  initialKind = 'task',
  onClose,
  onSaved,
}: {
  profile: Profile;
  classroom: Classroom;
  initialKind?: 'task' | 'exam';
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<{
    kind: 'task' | 'exam';
    title: string;
    subject: string;
    instructions: string;
    due: string;
    points: string;
  }>({
    kind: initialKind,
    title: '',
    subject: classroom.subject,
    instructions: '',
    due: '',
    points: '10',
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('assignments').insert({
      kind: form.kind,
      classroom_id: classroom.id,
      created_by: profile.id,
      title: form.title.trim(),
      subject: form.subject.trim(),
      instructions: form.instructions.trim(),
      due_at: form.due ? new Date(`${form.due}T23:59:00`).toISOString() : null,
      points: Number(form.points),
    });
    setBusy(false);
    if (error) setNotice(friendlySupabaseError(error.message));
    else {
      await onSaved();
      onClose();
    }
  }
  return (
    <Modal
      title={form.kind === 'exam' ? 'Nova prova' : 'Nova atividade'}
      onClose={onClose}
    >
      <form className="teacher-form" onSubmit={submit}>
        <label>
          Tipo
          <select
            value={form.kind}
            onChange={(e) =>
              setForm({
                ...form,
                kind: e.target.value === 'exam' ? 'exam' : 'task',
              })
            }
          >
            <option value="task">Tarefa</option>
            <option value="exam">Prova</option>
          </select>
        </label>
        <label>
          Título
          <input
            required
            minLength={2}
            maxLength={120}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex.: Revisão de frações"
          />
        </label>
        <label>
          Componente curricular
          <input
            required
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
        </label>
        <label>
          Orientações
          <textarea
            maxLength={4000}
            rows={5}
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            placeholder="Explique o que o aluno precisa fazer."
          />
        </label>
        <div className="teacher-form-row">
          <label>
            Prazo
            <input
              type="date"
              value={form.due}
              onChange={(e) => setForm({ ...form, due: e.target.value })}
            />
          </label>
          <label>
            Pontos
            <input
              required
              type="number"
              min="1"
              max="1000"
              value={form.points}
              onChange={(e) => setForm({ ...form, points: e.target.value })}
            />
          </label>
        </div>
        {notice && <p className="teacher-notice">{notice}</p>}
        <button className="teacher-primary" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" />
          ) : form.kind === 'exam' ? (
            'Publicar prova'
          ) : (
            'Publicar atividade'
          )}
        </button>
      </form>
    </Modal>
  );
}
function AnnouncementForm({
  profile,
  classroom,
  onClose,
  onSaved,
}: {
  profile: Profile;
  classroom: Classroom;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('announcements').insert({
      classroom_id: classroom.id,
      author_id: profile.id,
      message: message.trim(),
    });
    setBusy(false);
    if (error) setNotice(friendlySupabaseError(error.message));
    else {
      await onSaved();
      onClose();
    }
  }
  return (
    <Modal title="Enviar recado" onClose={onClose}>
      <form className="teacher-form" onSubmit={submit}>
        <p className="teacher-form-help">
          O recado aparecerá imediatamente para todos os alunos de{' '}
          <strong>{classroom.name}</strong>.
        </p>
        <label>
          Mensagem
          <textarea
            required
            minLength={1}
            maxLength={1000}
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex.: Não esqueçam de revisar o material antes da próxima aula."
          />
        </label>
        <small className="teacher-char-count">{message.length}/1000</small>
        {notice && <p className="teacher-notice">{notice}</p>}
        <button className="teacher-primary" disabled={busy || !message.trim()}>
          {busy ? (
            <LoaderCircle className="spin" />
          ) : (
            <>
              <MessageSquare />
              Enviar para a turma
            </>
          )}
        </button>
      </form>
    </Modal>
  );
}
function GradeForm({
  submission,
  assignment,
  onClose,
  onSaved,
}: {
  submission: Submission;
  assignment: Assignment;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [score, setScore] = useState(submission.score?.toString() ?? '');
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const numericScore = Number(score);
    if (numericScore < 0 || numericScore > assignment.points) {
      setNotice(`Informe uma nota entre 0 e ${assignment.points}.`);
      setBusy(false);
      return;
    }
    const { error } = await supabase.rpc('grade_submission', {
      target_submission: submission.id,
      new_score: numericScore,
      new_feedback: feedback.trim(),
    });
    setBusy(false);
    if (error) setNotice(friendlySupabaseError(error.message));
    else {
      await onSaved();
      onClose();
    }
  }
  return (
    <Modal title="Corrigir entrega" onClose={onClose}>
      <div className="teacher-grade-answer">
        <small>
          {submission.profiles?.display_name ?? 'Aluno'} · {assignment.title}
        </small>
        <p>{submission.answer}</p>
      </div>
      <form className="teacher-form" onSubmit={submit}>
        <div className="teacher-form-row">
          <label>
            Pontos conquistados
            <input
              required
              type="number"
              min="0"
              max={assignment.points}
              step="0.5"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </label>
          <div className="teacher-max-points">
            <small>VALOR DA ATIVIDADE</small>
            <strong>{assignment.points} pontos</strong>
          </div>
        </div>
        <label>
          Comentário para o aluno
          <textarea
            maxLength={4000}
            rows={5}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Reconheça o que foi bem feito e indique o próximo passo."
          />
        </label>
        {notice && <p className="teacher-notice">{notice}</p>}
        <button className="teacher-primary" disabled={busy}>
          {busy ? <LoaderCircle className="spin" /> : 'Salvar correção'}
        </button>
      </form>
    </Modal>
  );
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="teacher-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <dialog
        open
        className={`teacher-modal${wide ? ' teacher-modal-wide' : ''}`}
        aria-modal="true"
        aria-label={title}
      >
        <div>
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        {children}
      </dialog>
    </div>,
    document.body,
  );
}
