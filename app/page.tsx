'use client';
import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Plus,
  X,
  Trash2,
  Sparkles,
  SlidersHorizontal,
  Download,
  CheckCircle2,
  Flame,
  Users,
  KeyRound,
  LogOut,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
} from '@/components/ui/sidebar';
import { Checkbox } from '@/components/ui/checkbox';
import { BrandLogo } from '@/components/brand-logo';
import { StudentHome } from '@/components/student-home';
import { StudentTaskRoute } from '@/components/student-task-route';
import {
  StudentResourcePage,
  type ResourceKey,
} from '@/components/student-resource-page';
import type { LearningPathStep } from '@/components/student-learning-path';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AppIcon, type IconName } from '@/components/classroom-icon';
import { StudentConnect } from '@/components/student-connect';
import { PwaInstall } from '@/components/pwa-install';
import {
  initialAuthCallbackType,
  studentSupabase,
  supabase,
} from '@/lib/supabase';
import {
  calculateConnectedProgress,
  friendlySupabaseError,
} from '@/lib/connected-flow';
import {
  activities,
  themes,
  fonts,
  initialState,
  parseState,
  validPreferences,
  STORAGE_KEY,
  applyPreferences,
  answerQuestion,
  submitActivity,
  score,
  localDate,
  type Preferences,
  type Activity,
} from '@/lib/classroom';

const RoomEditor = lazy(() =>
  import('@/components/room-editor').then((module) => ({
    default: module.RoomEditor,
  })),
);
const TeacherPortal = lazy(() =>
  import('@/components/teacher-portal').then((module) => ({
    default: module.TeacherPortal,
  })),
);

const LAST_AUTH_MODE_KEY = 'aprende-last-auth-mode';

function rememberAuthMode(mode: 'teacher' | 'student') {
  try {
    localStorage.setItem(LAST_AUTH_MODE_KEY, mode);
  } catch {}
}

function readLastAuthMode() {
  try {
    return localStorage.getItem(LAST_AUTH_MODE_KEY);
  } catch {
    return null;
  }
}

function LoadingArea({ text }: { text: string }) {
  return (
    <div className="portal-loading">
      <span className="spin" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

function EmailConfirmationScreen({
  role,
  onContinue,
}: {
  role: 'teacher' | 'student';
  onContinue: () => void;
}) {
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>(
    'checking',
  );
  useEffect(() => {
    let active = true;
    const client = role === 'teacher' ? supabase : studentSupabase;
    async function checkConfirmation() {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const { data } = await client.auth.getSession();
        if (data.session?.user) {
          if (active) setStatus('success');
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
      if (active) setStatus('error');
    }
    void checkConfirmation();
    return () => {
      active = false;
    };
  }, [role]);
  return (
    <main className="email-confirmation-page">
      <section className="email-confirmation-card" aria-live="polite">
        <span
          className={
            status === 'success'
              ? 'email-confirmation-icon success'
              : 'email-confirmation-icon'
          }
        >
          <CheckCircle2 size={30} />
        </span>
        {status === 'checking' && (
          <>
            <span className="teacher-kicker">CONFIRMANDO SEU E-MAIL</span>
            <h1>Estamos ativando sua conta…</h1>
            <p>Aguarde um instante enquanto concluímos a confirmação.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <span className="teacher-kicker">E-MAIL CONFIRMADO</span>
            <h1>Sua conta está ativa.</h1>
            <p>
              Agora você já pode voltar e entrar como{' '}
              {role === 'teacher' ? 'professor' : 'aluno'}.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <span className="teacher-kicker">NÃO FOI POSSÍVEL CONFIRMAR</span>
            <h1>O link pode ter expirado.</h1>
            <p>
              Solicite um novo e-mail de confirmação e abra o link mais recente.
            </p>
          </>
        )}
        <button className="teacher-primary" onClick={onContinue}>
          Voltar para entrar
        </button>
      </section>
    </main>
  );
}

function PasswordRecoveryScreen({
  role,
  onContinue,
}: {
  role: 'teacher' | 'student';
  onContinue: () => void | Promise<void>;
}) {
  const [status, setStatus] = useState<
    'checking' | 'ready' | 'success' | 'error'
  >('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const client = role === 'teacher' ? supabase : studentSupabase;

  useEffect(() => {
    let active = true;
    async function checkRecoverySession() {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const { data } = await client.auth.getSession();
        if (data.session?.user) {
          if (active) setStatus('ready');
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
      if (active) setStatus('error');
    }
    void checkRecoverySession();
    return () => {
      active = false;
    };
  }, [client]);

  async function updatePassword(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    if (password.length < 8) {
      setNotice('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setNotice('As senhas não são iguais. Confira e tente novamente.');
      return;
    }
    setBusy(true);
    const { error } = await client.auth.updateUser({ password });
    setBusy(false);
    if (error) setNotice(friendlySupabaseError(error.message));
    else setStatus('success');
  }

  return (
    <main className="email-confirmation-page">
      <section
        className="email-confirmation-card password-recovery-card"
        aria-live="polite"
      >
        <span className="email-confirmation-icon">
          <KeyRound size={30} />
        </span>
        {status === 'checking' && (
          <>
            <span className="teacher-kicker">RECUPERANDO SUA CONTA</span>
            <h1>Abrindo o link seguro…</h1>
            <p>Aguarde enquanto validamos sua solicitação.</p>
          </>
        )}
        {status === 'ready' && (
          <>
            <span className="teacher-kicker">NOVA SENHA</span>
            <h1>Crie uma nova senha.</h1>
            <p>Use pelo menos 8 caracteres e confirme abaixo.</p>
            <form onSubmit={updatePassword}>
              <label>
                Nova senha
                <input
                  required
                  minLength={8}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label>
                Confirmar nova senha
                <input
                  required
                  minLength={8}
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>
              {notice && <output className="teacher-notice">{notice}</output>}
              <button className="teacher-primary" disabled={busy}>
                {busy ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          </>
        )}
        {status === 'success' && (
          <>
            <span className="teacher-kicker">SENHA ATUALIZADA</span>
            <h1>Tudo certo!</h1>
            <p>Sua nova senha já pode ser usada para entrar no Aprendê.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <span className="teacher-kicker">LINK INVÁLIDO</span>
            <h1>Este link expirou.</h1>
            <p>Volte ao login e solicite um novo link de recuperação.</p>
          </>
        )}
        {(status === 'success' || status === 'error') && (
          <button className="teacher-primary" onClick={() => void onContinue()}>
            Voltar para entrar
          </button>
        )}
      </section>
    </main>
  );
}
const navigation: { id: string; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Minha sala', icon: 'home' },
  { id: 'tasks', label: 'Trilha de tarefas', icon: 'tasks' },
  { id: 'calendar', label: 'Calendário', icon: 'calendar' },
  { id: 'grades', label: 'Meu boletim', icon: 'grades' },
  { id: 'resource:exams', label: 'Provas', icon: 'tasks' },
];
type ConnectedAssignment = {
  id: string;
  title: string;
  subject: string;
  instructions: string;
  due_at: string | null;
  points: number;
  created_at: string;
  kind?: 'task' | 'exam';
};
type ConnectedSubmission = {
  assignment_id: string;
  status: 'draft' | 'submitted';
  score: number | null;
  feedback: string | null;
};
type ConnectedAnnouncement = {
  id: string;
  classroom_id: string;
  message: string;
  created_at: string;
};
export default function Home() {
  const [state, setState] = useState(initialState),
    [ready, setReady] = useState(false),
    [editing, setEditing] = useState(false),
    [editorSaving, setEditorSaving] = useState(false),
    [draft, setDraft] = useState<Preferences>(state.preferences),
    [editorTab, setEditorTab] = useState('theme'),
    [view, setView] = useState('home'),
    [resourceView, setResourceView] = useState<ResourceKey | null>(null),
    [attendanceRecords,setAttendanceRecords] = useState<{present:boolean;attendance_date:string}[]|null>(null),
    [connectedActivityId, setConnectedActivityId] = useState<string | null>(
      null,
    ),
    [notice, setNotice] = useState(''),
    [storageError, setStorageError] = useState(false),
    [activeTask, setActiveTask] = useState<Activity | null>(null),
    [material, setMaterial] = useState<Activity | null>(null),
    [reminderInput, setReminderInput] = useState(''),
    [eventOpen, setEventOpen] = useState(false),
    [eventTitle, setEventTitle] = useState(''),
    [eventTime, setEventTime] = useState('15:00'),
    [today, setToday] = useState('2026-09-08'),
    [selectedDate, setSelectedDate] = useState('2026-09-08'),
    [month, setMonth] = useState(new Date(2026, 8, 1)),
    [authModeReady, setAuthModeReady] = useState(false),
    [showTeacher, setShowTeacher] = useState(false),
    [showStudentConnect, setShowStudentConnect] = useState(true),
    [confirmationMode, setConfirmationMode] = useState<
      'teacher' | 'student' | null
    >(null),
    [recoveryMode, setRecoveryMode] = useState<'teacher' | 'student' | null>(
      null,
    ),
    [studentAuthReady, setStudentAuthReady] = useState(false),
    [studentSummary, setStudentSummary] = useState<{
      name: string;
      earned: number;
      possible: number;
      totalAvailable: number;
      evaluatedPoints: number;
      pending: number;
      evaluatedPercentage: number | null;
      classCount: number;
      assignments: ConnectedAssignment[];
      submissions: ConnectedSubmission[];
      announcements: ConnectedAnnouncement[];
    } | null>(null);
  const stateRef = useRef(state);
  const autoCloseStudentConnect = useRef(true);
  const openTeacherMode = useCallback(() => {
    rememberAuthMode('teacher');
    setShowStudentConnect(false);
    setShowTeacher(true);
  }, []);
  const openStudentMode = useCallback(() => {
    rememberAuthMode('student');
    setShowTeacher(false);
    setShowStudentConnect(true);
  }, []);
  useEffect(() => {
    if (
      'serviceWorker' in navigator &&
      window.location.hostname !== 'localhost'
    ) {
      void navigator.serviceWorker.register('./sw.js', { scope: './' });
    }
  }, []);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const authMode = params.get('auth');
    if (params.get('qa') === 'teacher-dashboard') {
      setShowStudentConnect(false);
      setShowTeacher(true);
      setAuthModeReady(true);
      return () => {
        active = false;
      };
    }
    if (authMode === 'teacher' || authMode === 'student') {
      rememberAuthMode(authMode);
      setAuthModeReady(true);
      return () => {
        active = false;
      };
    }
    void Promise.all([
      studentSupabase.auth.getSession(),
      supabase.auth.getSession(),
    ])
      .then(([studentResult, teacherResult]) => {
        if (!active) return;
        const lastMode = readLastAuthMode();
        const hasStudentSession = !!studentResult.data.session;
        const hasTeacherSession = !!teacherResult.data.session;
        if (
          hasTeacherSession &&
          (lastMode === 'teacher' || !hasStudentSession)
        ) {
          setShowStudentConnect(false);
          setShowTeacher(true);
        } else {
          setShowTeacher(false);
          setShowStudentConnect(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setAuthModeReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    try {
      setState(parseState(localStorage.getItem(STORAGE_KEY)));
    } catch {
      setStorageError(true);
    }
    const now = new Date();
    setToday(localDate(now));
    setSelectedDate(localDate(now));
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setReady(true);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authMode = params.get('auth');
    if (authMode === 'teacher' || authMode === 'student') {
      if (
        params.get('recovery') === '1' ||
        initialAuthCallbackType === 'recovery'
      )
        setRecoveryMode(authMode);
      else setConfirmationMode(authMode);
    }
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [state, ready]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(id);
  }, [notice]);
  const refreshStudentSummary = useCallback(async () => {
    const {
      data: { session },
    } = await studentSupabase.auth.getSession();
    if (!session) {
      setStudentSummary(null);
      setStudentAuthReady(true);
      return;
    }
    const profileResult = await studentSupabase
      .from('profiles')
      .select('display_name,role')
      .eq('id', session.user.id)
      .single();
    if (profileResult.data?.role !== 'student') {
      setStudentSummary(null);
      setStudentAuthReady(true);
      return;
    }
    const attendanceResult = await studentSupabase.from('attendance').select('present,attendance_date').eq('student_id',session.user.id);
    setAttendanceRecords(attendanceResult.error ? null : attendanceResult.data);
    const membershipResult = await studentSupabase
      .from('memberships')
      .select('classroom_id')
      .eq('user_id', session.user.id);
    const classIds = (membershipResult.data ?? []).map(
      (item) => item.classroom_id,
    );
    let connectedAssignments: ConnectedAssignment[] = [];
    let connectedSubmissions: ConnectedSubmission[] = [];
    let connectedAnnouncements: ConnectedAnnouncement[] = [];
    if (classIds.length) {
      const [assignmentResult, announcementResult] = await Promise.all([
        studentSupabase
          .from('assignments')
          .select('*')
          .in('classroom_id', classIds)
          .order('created_at', { ascending: false }),
        studentSupabase
          .from('announcements')
          .select('id,classroom_id,message,created_at')
          .in('classroom_id', classIds)
          .order('created_at', { ascending: false }),
      ]);
      connectedAssignments = (assignmentResult.data ?? []).map((item) => {
        const kind: ConnectedAssignment['kind'] =
          item.kind === 'exam' ? 'exam' : 'task';
        return {
          id: item.id,
          title: item.title,
          subject: item.subject,
          instructions: item.instructions,
          due_at: item.due_at,
          points: item.points,
          created_at: item.created_at,
          kind,
        };
      });
      connectedAnnouncements = announcementResult.data ?? [];
      if (connectedAssignments.length) {
        const submissionResult = await studentSupabase
          .from('submissions')
          .select('assignment_id,status,score,feedback')
          .in(
            'assignment_id',
            connectedAssignments.map((item) => item.id),
          );
        connectedSubmissions = submissionResult.data ?? [];
      }
    }
    if (session.user.user_metadata?.student_appearance) {
      setState((current) => ({
        ...current,
        preferences: validPreferences({
          ...current.preferences,
          ...session.user.user_metadata.student_appearance,
          name: profileResult.data?.display_name ?? current.preferences.name,
        }),
      }));
    }
    const progress = calculateConnectedProgress(
      connectedAssignments,
      connectedSubmissions,
    );
    setStudentSummary({
      name: profileResult.data.display_name,
      earned: progress.earned,
      possible: progress.evaluatedPoints,
      totalAvailable: progress.totalAvailable,
      evaluatedPoints: progress.evaluatedPoints,
      pending: progress.pending,
      evaluatedPercentage: progress.percentage,
      classCount: classIds.length,
      assignments: connectedAssignments,
      submissions: connectedSubmissions,
      announcements: connectedAnnouncements,
    });
    setStudentAuthReady(true);
  }, []);
  useEffect(() => {
    void refreshStudentSummary();
    const { data } = studentSupabase.auth.onAuthStateChange(() => {
      void refreshStudentSummary();
    });
    return () => data.subscription.unsubscribe();
  }, [refreshStudentSummary]);
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshStudentSummary();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshStudentSummary]);
  useEffect(() => {
    if (
      authModeReady &&
      !showTeacher &&
      autoCloseStudentConnect.current &&
      studentAuthReady &&
      studentSummary
    ) {
      autoCloseStudentConnect.current = false;
      rememberAuthMode('student');
      setShowStudentConnect(false);
    }
  }, [authModeReady, showTeacher, studentAuthReady, studentSummary]);
  useEffect(() => {
    if (authModeReady && studentAuthReady && !showTeacher && !showStudentConnect) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [authModeReady, studentAuthReady, showTeacher, showStudentConnect]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: unknown) => {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'set_customization_panel',
      description:
        'Abre ou fecha o editor. Fechar descarta a prévia sem salvar nem cobrar moedas.',
      inputSchema: {
        type: 'object',
        properties: { open: { type: 'boolean' } },
        required: ['open'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input: unknown) => {
        if (
          !input ||
          typeof input !== 'object' ||
          !('open' in input) ||
          typeof input.open !== 'boolean'
        )
          throw new Error('Informe open como booleano.');
        if (input.open) setDraft({ ...stateRef.current.preferences });
        setEditing(input.open);
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        return { open: input.open };
      },
    });
    register({
      name: 'read_room_state',
      description: 'Lê as preferências salvas e o progresso local da sala.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => ({
        preferences: stateRef.current.preferences,
        coins: stateRef.current.coins,
        completed: activities
          .filter((a) => stateRef.current.attempts[a.id]?.submitted)
          .map((a) => a.id),
        reminders: stateRef.current.reminders,
        events: stateRef.current.events,
      }),
    });
    return () => lifecycle.abort();
  }, []);
  const p = editing ? draft : state.preferences,
    studentName = studentSummary?.name || p.name,
    theme = themes.find((x) => x.id === p.theme)!,
    font = fonts.find((x) => x.id === p.font)!;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = p.theme;
    root.dataset.cursor = p.cursor;
    root.style.setProperty('--primary', theme.color);
    root.style.setProperty('--primary-soft', theme.soft);
    root.style.setProperty('--room-font', font.family);
  }, [p.theme, p.cursor, theme, font]);
  function openEditor(tab = 'banner') {
    setDraft({
      ...state.preferences,
      name: studentSummary?.name || state.preferences.name,
    });
    setEditorTab(tab);
    setEditing(true);
  }
  async function saveEditor() {
    const nextPreferences = { ...draft, name: draft.name.trim() };
    try {
      const nextState = applyPreferences(stateRef.current, nextPreferences);
      setEditorSaving(true);
      if (studentSummary) {
        const {
          data: { session },
        } = await studentSupabase.auth.getSession();
        if (!session) throw new Error('Sua sessão expirou. Entre novamente.');
        const { error } = await studentSupabase
          .from('profiles')
          .update({ display_name: nextPreferences.name })
          .eq('id', session.user.id);
        if (error) throw error;
        const { error: appearanceError } =
          await studentSupabase.auth.updateUser({
            data: {
              student_appearance: {
                presentation: nextPreferences.presentation,
                accessory: nextPreferences.accessory,
                accessoryColor: nextPreferences.accessoryColor,
                hair: nextPreferences.hair,
                hairColor: nextPreferences.hairColor,
                skin: nextPreferences.skin,
                eyeColor: nextPreferences.eyeColor,
                outfit: nextPreferences.outfit,
                outfitColor: nextPreferences.outfitColor,
                banner: nextPreferences.banner,
              },
            },
          });
        if (appearanceError) throw appearanceError;
      }
      setState(nextState);
      setStudentSummary((current) =>
        current ? { ...current, name: nextPreferences.name } : current,
      );
      setEditing(false);
      setNotice(
        studentSummary
          ? 'Seu nome e sua sala foram atualizados!'
          : 'Sua sala foi personalizada!',
      );
      if (studentSummary) await refreshStudentSummary();
    } catch (e) {
      setNotice(friendlySupabaseError((e as Error).message));
    } finally {
      setEditorSaving(false);
    }
  }
  function changeView(v: string) {
    if (v.startsWith('resource:')) {
      setResourceView(v.slice('resource:'.length) as ResourceKey);
      setView('resource');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setResourceView(null);
    setView(v);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function openConnectedActivity(id: string) {
    if (studentSummary) {
      setConnectedActivityId(id);
      setShowStudentConnect(true);
    } else {
      setActiveTask(activities.find((activity) => activity.id === id) ?? null);
    }
  }
  const completed = activities.filter((a) => state.attempts[a.id]?.submitted),
    attendanceToday = state.attendance.includes(today);
  const teacherAssignments = studentSummary?.assignments ?? [];
  const teacherSubmissions = studentSummary?.submissions ?? [];
  const teacherAnnouncements = studentSummary?.announcements ?? [];
  const teacherDelivered = teacherSubmissions.filter(
    (item) => item.status === 'submitted',
  ).length;
  const connectedProgress = studentSummary
    ? calculateConnectedProgress(teacherAssignments, teacherSubmissions)
    : null;
  const connectedAttendance = attendanceRecords === null
    ? null
    : {
        total: attendanceRecords.length,
        absences: attendanceRecords.filter((record) => !record.present).length,
        percentage: attendanceRecords.length
          ? Math.round(
              (attendanceRecords.filter((record) => record.present).length /
                attendanceRecords.length) *
                100,
            )
          : null,
      };
  const learningPathSteps: LearningPathStep[] = studentSummary
    ? [...teacherAssignments].filter(a => a.kind !== 'exam').sort((a,b)=>a.created_at.localeCompare(b.created_at)).map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        completed: teacherSubmissions.some(
          (submission) =>
            submission.assignment_id === assignment.id &&
            submission.status === 'submitted',
        ),
      }))
    : activities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        completed: !!state.attempts[activity.id]?.submitted,
      }));
  const dayEvents = state.events
    .filter((e) => e.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  function addReminder(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reminderInput.trim()) return;
    setState((s) => ({
      ...s,
      reminders: [
        ...s.reminders,
        { id: crypto.randomUUID(), text: reminderInput.trim(), done: false },
      ],
    }));
    setReminderInput('');
  }
  function addEvent(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    setState((s) => ({
      ...s,
      events: [
        ...s.events,
        {
          id: crypto.randomUUID(),
          date: selectedDate,
          time: eventTime,
          title: eventTitle.trim(),
        },
      ],
    }));
    setEventOpen(false);
    setEventTitle('');
    setNotice('Evento adicionado ao calendário.');
  }
  function submit() {
    if (!activeTask) return;
    try {
      setState((s) => submitActivity(s, activeTask.id));
      setNotice('Atividade concluída! Você ganhou 50 moedas.');
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  const calendar = (
    <section className="calendar card">
      <div className="card-heading">
        <h2>
          <AppIcon name="calendar" pack={p.icons} size={20} /> Calendário
        </h2>
        <button
          className="text-button"
          onClick={() => {
            const now = new Date();
            setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
            setSelectedDate(today);
          }}
        >
          Hoje
        </button>
      </div>
      <div className="month-heading">
        <strong>
          {month.toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric',
          })}
        </strong>
        <div>
          <button
            className="icon-button"
            aria-label="Mês anterior"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Próximo mês"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((w, i) => (
          <span className="weekday" key={i}>
            {w}
          </span>
        ))}
        {Array.from({ length: month.getDay() }, (_, i) => (
          <span key={`blank${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = localDate(
            new Date(month.getFullYear(), month.getMonth(), i + 1),
          );
          return (
            <button
              key={d}
              className={`${selectedDate === d ? 'selected' : ''} ${d === today ? 'today' : ''}`}
              aria-pressed={selectedDate === d}
              aria-label={new Date(
                month.getFullYear(),
                month.getMonth(),
                i + 1,
              ).toLocaleDateString('pt-BR', { dateStyle: 'full' })}
              onClick={() => setSelectedDate(d)}
            >
              {i + 1}
              {(state.events.some((e) => e.date === d) || teacherAssignments.some(a=>a.due_at && localDate(new Date(a.due_at))===d)) && <i />}
            </button>
          );
        })}
      </div>
      <div className="calendar-events">
        <div>
          <strong>
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', {
              day: 'numeric',
              month: 'long',
            })}
          </strong>
          <button
            className="icon-button"
            aria-label="Adicionar evento"
            onClick={() => setEventOpen(true)}
          >
            <Plus size={17} />
          </button>
        </div>
        {teacherAssignments.filter(a=>a.due_at && localDate(new Date(a.due_at))===selectedDate).map(a=><button key={a.id} className="student-calendar-deadline" onClick={()=>openConnectedActivity(a.id)}><strong>{a.kind==='exam'?'Prova':'Tarefa'}: {a.title}</strong><span>{a.subject} · Abrir <ArrowRight size={14}/></span></button>)}
        {dayEvents.length ? (
          dayEvents.map((e) => (
            <div className="event-row" key={e.id}>
              <span>{e.time}</span>
              <strong>{e.title}</strong>
              <button
                className="icon-button"
                aria-label={`Excluir evento ${e.title}`}
                onClick={() => {
                  setState((s) => ({
                    ...s,
                    events: s.events.filter((x) => x.id !== e.id),
                  }));
                  setNotice('Evento removido.');
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        ) : (
          <p className="empty-note">Nenhum compromisso pessoal neste dia.</p>
        )}
      </div>
    </section>
  );
  const reminders = (
    <section className="reminders card">
      <div className="card-heading">
        <h2>
          <AppIcon name="bell" pack={p.icons} size={20} /> Lembretes
        </h2>
        <span className="count-badge">
          {state.reminders.filter((r) => !r.done).length}
        </span>
      </div>
      <div className="reminder-list">
        {state.reminders.map((r) => (
          <div className={`reminder-row ${r.done ? 'done' : ''}`} key={r.id}>
            <label>
              <Checkbox
                checked={r.done}
                onCheckedChange={(checked) =>
                  setState((s) => ({
                    ...s,
                    reminders: s.reminders.map((x) =>
                      x.id === r.id ? { ...x, done: !!checked } : x,
                    ),
                  }))
                }
              />
              <span>{r.text}</span>
            </label>
            <button
              className="icon-button delete-reminder"
              aria-label={`Excluir lembrete ${r.text}`}
              onClick={() =>
                setState((s) => ({
                  ...s,
                  reminders: s.reminders.filter((x) => x.id !== r.id),
                }))
              }
            >
              <X size={15} />
            </button>
          </div>
        ))}
        {!state.reminders.length && (
          <p className="empty-note">
            Tudo organizado! Adicione um novo lembrete.
          </p>
        )}
      </div>
      <form className="add-reminder" onSubmit={addReminder}>
        <input
          aria-label="Novo lembrete"
          placeholder="Adicionar lembrete…"
          maxLength={160}
          value={reminderInput}
          onChange={(e) => setReminderInput(e.target.value)}
        />
        <button
          className="icon-button"
          aria-label="Salvar lembrete"
          disabled={!reminderInput.trim()}
        >
          <Plus size={19} />
        </button>
      </form>
    </section>
  );
  if (recoveryMode)
    return (
      <>
        <PasswordRecoveryScreen
          role={recoveryMode}
          onContinue={async () => {
            const client =
              recoveryMode === 'teacher' ? supabase : studentSupabase;
            await client.auth.signOut();
            window.history.replaceState({}, '', window.location.pathname);
            const mode = recoveryMode;
            setRecoveryMode(null);
            if (mode === 'teacher') openTeacherMode();
            else openStudentMode();
          }}
        />
        <PwaInstall />
      </>
    );
  if (confirmationMode)
    return (
      <>
        <EmailConfirmationScreen
          role={confirmationMode}
          onContinue={() => {
            window.history.replaceState({}, '', window.location.pathname);
            setConfirmationMode(null);
            if (confirmationMode === 'teacher') {
              openTeacherMode();
            } else {
              openStudentMode();
            }
          }}
        />
        <PwaInstall />
      </>
    );
  if (!authModeReady)
    return (
      <>
        <LoadingArea text="Abrindo sua conta..." />
        <PwaInstall />
      </>
    );
  if (showTeacher)
    return (
      <>
        <Suspense fallback={<LoadingArea text="Abrindo o modo professor..." />}>
          <TeacherPortal onClose={openStudentMode} />
        </Suspense>
        <PwaInstall />
      </>
    );
  if (showStudentConnect)
    return (
      <>
        <StudentConnect
          pageMode
          allowClose={!!studentSummary}
          onClose={() => setShowStudentConnect(false)}
          onOpenTeacher={openTeacherMode}
          onChanged={refreshStudentSummary}
          initialAssignmentId={connectedActivityId}
        />
        <PwaInstall />
      </>
    );
  return (
    <div
      className={`school student-experience ${view === 'home' ? 'student-home' : 'student-inner'} ${editing ? 'is-editing' : ''}`}
    >
      <PwaInstall />
      <SidebarProvider>
        <Sidebar collapsible="none" className="school-sidebar">
          <button
            type="button"
            className="brand"
            aria-label="Aprendê - página inicial"
            onClick={() => changeView('home')}
          >
            <span className="brand-icon brand-mark-shell">
              <BrandLogo />
            </span>
            <strong>Aprendê</strong>
          </button>
          <SidebarContent>
            <p className="nav-caption">MEU ESPAÇO</p>
            <nav aria-label="Navegação principal">
              {navigation.map((n) => (
                <button
                  key={n.id}
                  aria-label={n.label}
                  className={`nav-item ${(view === n.id || (n.id === 'resource:exams' && resourceView === 'exams')) ? 'active' : ''}`}
                  aria-current={(view === n.id || (n.id === 'resource:exams' && resourceView === 'exams')) ? 'page' : undefined}
                  onClick={() => changeView(n.id)}
                >
                  <AppIcon name={n.icon} pack={p.icons} size={23} />
                  <span>{n.label}</span>
                  {n.id === 'tasks' && (
                    <small>
                      {studentSummary
                        ? teacherAssignments.length - teacherDelivered
                        : activities.length - completed.length}
                    </small>
                  )}
                </button>
              ))}
            <button className="nav-item" aria-label="Sair da plataforma" onClick={async()=>{await studentSupabase.auth.signOut();setShowStudentConnect(true);}}><LogOut size={23}/><span>Sair</span></button>
            </nav>
            <div className="sidebar-customize">
              <span className="customize-illustration">
                <AppIcon name="palette" pack={p.icons} size={33} />
                <Sparkles size={18} />
              </span>
              <strong>Uma sala com a sua cara.</strong>
              <p>Cores, fontes e muitas possibilidades.</p>
              <button onClick={() => openEditor()}>
                Personalizar <ArrowUpRight size={15} />
              </button>
            </div>
          </SidebarContent>
          <div className="sidebar-profile">
            <img src={`./avatars/avatar-${p.avatar}.svg`} alt="Seu avatar" />
            <span>
              <strong>{studentName}</strong>
              <small>
                {studentSummary
                  ? `Aluno conectado · ${studentSummary.classCount} ${studentSummary.classCount === 1 ? 'turma' : 'turmas'}`
                  : `Estudante · Nível ${5 + Math.floor(completed.length / 3)}`}
              </small>
            </span>
            <button
              className="icon-button sidebar-profile-action"
              onClick={() => openEditor('profile')}
              aria-label="Editar meu perfil"
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>
        </Sidebar>
        <main className="workspace">
          {view !== 'home' && (
            <header className="topbar">
              <div>
                <span className="mobile-wordmark">Aprendê</span>
                <span className="breadcrumb">
                  Sala do Aluno <ChevronRight size={13} />{' '}
                  {navigation.find((n) => n.id === view)?.label}
                </span>
                <h1>
                  {view === 'home'
                    ? `Olá, ${studentName.split(' ')[0]}!`
                    : view === 'materials'
                      ? 'Materiais'
                      : view === 'resource'
                        ? resourceView === 'exams'
                          ? 'Provas'
                          : resourceView === 'speak'
                            ? 'Speak'
                            : resourceView === 'matific'
                              ? 'Matific'
                              : resourceView === 'platform'
                                ? 'Plataforma'
                                : resourceView === 'books'
                                  ? 'E-books'
                                  : 'Recursos'
                      : navigation.find((n) => n.id === view)?.label}
                </h1>
              </div>
              <div className="header-actions">
                <button
                  className="student-connect-button"
                  aria-label={
                    studentSummary ? 'Abrir minha turma' : 'Entrar em uma turma'
                  }
                  onClick={() => setShowStudentConnect(true)}
                >
                  <Users size={18} />
                  <span>
                    {studentSummary ? 'Minha turma' : 'Entrar na turma'}
                  </span>
                </button>
                <span
                  className="coin-wallet"
                  title={
                    studentSummary
                      ? 'Pontos recebidos do professor'
                      : 'Moedas das missões locais'
                  }
                >
                  <Coins size={20} />
                  <strong>
                    {studentSummary
                      ? `${studentSummary.earned}/${studentSummary.possible} pts`
                      : state.coins.toLocaleString('pt-BR')}
                  </strong>
                </span>
                <button
                  className="edit-button"
                  aria-label="Personalizar minha sala"
                  onClick={() => openEditor()}
                >
                  <SlidersHorizontal size={17} />
                  <span>Personalizar</span>
                </button>
              </div>
            </header>
          )}
          {view === 'home' && (
            <StudentHome
              name={studentName}
              preferences={p}
              earned={studentSummary?.earned ?? 0}
              possible={studentSummary?.possible ?? 0}
              steps={learningPathSteps}
              attendance={connectedAttendance}
              calendar={calendar}
              onNavigate={changeView}
              onClassroom={() => {
                setConnectedActivityId(null);
                setShowStudentConnect(true);
              }}
              onTeacher={openTeacherMode}
              onCustomize={openEditor}
              onActivity={openConnectedActivity}
            />
          )}
          {view === 'tasks' && <StudentTaskRoute name={studentName} preferences={p} work={teacherAssignments} results={teacherSubmissions} onOpen={openConnectedActivity}/>}
          {view === 'resource' && resourceView === 'exams' && <StudentTaskRoute exams name={studentName} preferences={p} work={teacherAssignments} results={teacherSubmissions} onOpen={openConnectedActivity}/>}
          {view === 'materials' && (
            <div className="materials-page">
              <div className="page-intro">
                <h2>Materiais de estudo</h2>
                <p>
                  {studentSummary
                    ? 'Conteúdos enviados pelo seu professor.'
                    : 'Conteúdos para aprender no seu ritmo.'}
                </p>
              </div>
              <section className="schedule" id="student-materials">
                <div className="schedule-list">
                  {studentSummary ? (
                    teacherAssignments.length ? (
                      teacherAssignments.map((a) => (
                        <button
                          key={a.id}
                          className="schedule-row blue"
                          onClick={() => openConnectedActivity(a.id)}
                        >
                          <span className="schedule-book">
                            <AppIcon name="tasks" pack={p.icons} size={23} />
                          </span>
                          <span className="schedule-details">
                            <strong>{a.title}</strong>
                            <small>
                              {a.subject} · {a.points} pontos
                            </small>
                          </span>
                          <ArrowUpRight size={18} />
                        </button>
                      ))
                    ) : (
                      <p className="empty-note">
                        O professor ainda não enviou materiais.
                      </p>
                    )
                  ) : (
                    activities.map((a) => (
                      <button
                        key={a.id}
                        className={`schedule-row ${a.color}`}
                        onClick={() => setMaterial(a)}
                      >
                        <span className="schedule-book">
                          <AppIcon name="tasks" pack={p.icons} size={23} />
                        </span>
                        <span className="schedule-details">
                          <strong>{a.title}</strong>
                          <small>{a.subject} · Material de apoio</small>
                        </span>
                        <ArrowUpRight size={18} />
                      </button>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
          {view === 'calendar' && (
            <>
              <div className="page-intro">
                <h2>Um espaço para seus planos.</h2>
                <p>
                  {studentSummary
                    ? 'Os lembretes enviados pelo professor aparecerão aqui.'
                    : 'Escolha um dia e adicione os compromissos que quer lembrar.'}
                </p>
              </div>
              <div className="calendar-page">
                {calendar}
                <div>
                  {!studentSummary && reminders}
                  {studentSummary && (
                    <section className="teacher-reminders card">
                      <div className="card-heading">
                        <h2>
                          <AppIcon name="bell" pack={p.icons} size={20} />
                          Recados da turma
                        </h2>
                        <span className="count-badge">
                          {teacherAnnouncements.length}
                        </span>
                      </div>
                      {teacherAnnouncements.length ? (
                        <div className="teacher-reminder-list">
                          {teacherAnnouncements.map((announcement) => (
                            <article key={announcement.id}>
                              <p>{announcement.message}</p>
                              <small>
                                Enviado em{' '}
                                {new Date(
                                  announcement.created_at,
                                ).toLocaleDateString('pt-BR')}
                              </small>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="empty-note">
                          Nenhum recado foi enviado pelo professor ainda.
                        </p>
                      )}
                    </section>
                  )}
                  <div className="info-card">
                    <AppIcon name="calendar" pack={p.icons} size={28} />
                    <h3>
                      {studentSummary
                        ? teacherAnnouncements.length
                          ? 'Recados disponíveis acima.'
                          : 'Aguardando os próximos recados.'
                        : 'Do seu jeito, no seu tempo.'}
                    </h3>
                    <p>
                      {studentSummary
                        ? 'Os recados do professor ficam reunidos nesta área; seus eventos pessoais continuam no calendário.'
                        : 'Seus eventos são pessoais e ficam guardados neste navegador.'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
          {view === 'grades' && (
            <>
              <section className="student-report-summary">
                <article>
                  <strong>
                    {connectedAttendance === null
                      ? 'Indisponível'
                      : connectedAttendance.percentage != null
                        ? `${connectedAttendance.percentage}%`
                        : 'Sem registros'}
                  </strong>
                  <span>
                    {connectedAttendance?.percentage != null
                      ? `${connectedAttendance.absences} ${connectedAttendance.absences === 1 ? 'falta' : 'faltas'} em ${connectedAttendance.total} ${connectedAttendance.total === 1 ? 'chamada' : 'chamadas'}`
                      : 'Presença registrada pelo professor'}
                  </span>
                  {connectedAttendance?.percentage != null && connectedAttendance.percentage < 75 && <small className="student-attendance-warning">Abaixo dos 75% mínimos - risco de reprovação por frequência.</small>}
                </article>
                <article>
                  <strong>
                    {connectedProgress
                      ? `${connectedProgress.earned}/${connectedProgress.evaluatedPoints}`
                      : '0/0'}
                  </strong>
                  <span>
                    Pontos avaliados · {connectedProgress?.totalAvailable ?? 0}{' '}
                    disponíveis
                  </span>
                </article>
                <article>
                  <strong>
                    {connectedProgress?.percentage == null
                      ? 'Aguardando'
                      : `${connectedProgress.percentage}%`}
                  </strong>
                  <span>
                    Aproveitamento · {connectedProgress?.pending ?? 0}{' '}
                    pendentes
                  </span>
                </article>
              </section>
              <div className="page-intro">
                <h2>Cada descoberta conta.</h2>
                <p>
                  {studentSummary
                    ? 'Acompanhe os resultados publicados pelo professor.'
                    : 'Acompanhe os resultados das atividades que você concluiu aqui.'}
                </p>
              </div>
              <section className="card grade-card">
                <div className="card-heading">
                  <h2>
                    <AppIcon name="grades" pack={p.icons} /> Resultados das
                    atividades
                  </h2>
                  <span className="small-label">Notas publicadas</span>
                </div>
                <div className="grade-list">
                  {studentSummary ? (
                    teacherAssignments
                      .filter((a) =>
                        teacherSubmissions.some(
                          (s) => s.assignment_id === a.id && s.score != null,
                        ),
                      )
                      .map((a) => {
                        const submission = teacherSubmissions.find(
                          (s) => s.assignment_id === a.id,
                        );
                        return (
                          <div className="grade-row" key={a.id}>
                            <span className="stat-icon blue">
                              <AppIcon name="tasks" pack={p.icons} />
                            </span>
                            <span>
                              <strong>{a.subject}</strong>
                              <small>
                                {a.title}
                                {submission?.feedback
                                  ? ` · ${submission.feedback}`
                                  : ''}
                              </small>
                            </span>
                            <strong className="grade-score">
                              {submission?.score}/{a.points}
                            </strong>
                          </div>
                        );
                      })
                  ) : (
                    <>
                      {activities.map((a) => (
                        <div className="grade-row" key={a.id}>
                          <span className={`stat-icon ${a.color}`}>
                            <AppIcon name="tasks" pack={p.icons} />
                          </span>
                          <span>
                            <strong>{a.subject}</strong>
                            <small>{a.title}</small>
                          </span>
                          <strong className="grade-score">
                            {score(a, state.attempts[a.id])?.toLocaleString(
                              'pt-BR',
                            ) ?? '-'}
                          </strong>
                          <button
                            className="text-button"
                            onClick={() => setActiveTask(a)}
                          >
                            {state.attempts[a.id]?.submitted
                              ? 'Revisar'
                              : 'Começar'}
                            <ArrowRight size={15} />
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                  {studentSummary &&
                    !teacherAssignments.some((a) =>
                      teacherSubmissions.some(
                        (s) => s.assignment_id === a.id && s.score != null,
                      ),
                    ) && (
                      <p className="empty-note">
                        Nenhum resultado foi publicado pelo professor ainda.
                      </p>
                    )}
                </div>
                <p className="muted-note">
                  {studentSummary
                    ? 'As notas e comentários são publicados pelo professor da turma.'
                    : 'Este boletim reúne suas práticas nesta sala. Não substitui o boletim oficial da escola.'}
                </p>
              </section>
            </>
          )}
          {view === 'attendance' && (
            <>
              <div className="page-intro">
                <h2>A constância faz a diferença.</h2>
                <p>
                  Registre os dias em que você reservou um tempo para estudar.
                </p>
              </div>
              <section className="card attendance-card">
                <span className="attendance-flame">
                  <Flame size={38} />
                </span>
                <h2>
                  {attendanceToday
                    ? 'Bom estudo hoje!'
                    : 'Já estudou um pouquinho hoje?'}
                </h2>
                <p>
                  {state.attendance.length}{' '}
                  {state.attendance.length === 1
                    ? 'dia registrado'
                    : 'dias registrados'}{' '}
                  no seu espaço de estudos.
                </p>
                <button
                  className="primary-button"
                  disabled={attendanceToday}
                  onClick={() => {
                    setState((s) =>
                      s.attendance.includes(today)
                        ? s
                        : { ...s, attendance: [...s.attendance, today] },
                    );
                    setNotice('Seu dia de estudo foi registrado.');
                  }}
                >
                  {attendanceToday ? (
                    <>
                      <Check size={18} /> Presença registrada
                    </>
                  ) : (
                    <>
                      Registrar meu estudo de hoje <Plus size={18} />
                    </>
                  )}
                </button>
                <div className="attendance-days">
                  {[...state.attendance]
                    .sort()
                    .reverse()
                    .map((d) => (
                      <span key={d}>
                        <CheckCircle2 size={16} />
                        {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
                          dateStyle: 'long',
                        })}
                      </span>
                    ))}
                </div>
                <p className="muted-note">
                  Registro pessoal de estudo, independente da chamada oficial da
                  escola.
                </p>
              </section>
            </>
          )}
          {view === 'resource' && resourceView && resourceView !== 'exams' && (
            <StudentResourcePage
              resource={resourceView}
              hasConnectedClass={!!studentSummary}
              onBack={() => changeView('home')}
              onTasks={() => changeView('tasks')}
            />
          )}
          <footer className="workspace-footer">
            <span>
              <AppIcon name="school" pack={p.icons} size={17} />
            </span>
            <span>
              {storageError
                ? 'Não foi possível salvar no navegador. Mantenha esta página aberta.'
                : ready
                  ? 'Seu progresso fica salvo neste navegador.'
                  : 'Carregando seu espaço…'}
            </span>
          </footer>
        </main>
      </SidebarProvider>
      {editing && (
        <Suspense fallback={null}>
          <RoomEditor
            key={editorTab}
            open={editing}
            onClose={() => setEditing(false)}
            draft={draft}
            onChange={setDraft}
            onSave={saveEditor}
            saving={editorSaving}
            accountConnected={!!studentSummary}
            owned={state.owned}
            coins={state.coins}
            initialTab={editorTab}
          />
        </Suspense>
      )}
      {showStudentConnect && (
        <StudentConnect
          pageMode
          allowClose={studentAuthReady && !!studentSummary}
          onClose={() => setShowStudentConnect(false)}
          onOpenTeacher={openTeacherMode}
          onChanged={refreshStudentSummary}
          initialAssignmentId={connectedActivityId}
        />
      )}
      <Dialog
        open={!!activeTask}
        onOpenChange={(v) => {
          if (!v) setActiveTask(null);
        }}
      >
        <DialogContent className="activity-dialog">
          <DialogTitle>{activeTask?.title}</DialogTitle>
          <DialogDescription>
            {activeTask?.subject} ·{' '}
            {state.attempts[activeTask?.id ?? '']?.submitted
              ? 'Resultado e revisão'
              : 'Responda às perguntas. Suas respostas são salvas automaticamente.'}
          </DialogDescription>
          {activeTask && (
            <div className="quiz-content">
              {activeTask.questions.map((q, i) => {
                const attempt = state.attempts[activeTask.id];
                const answer = attempt?.answers[i];
                return (
                  <section className="quiz-question" key={i}>
                    <h3>
                      <span>{i + 1}</span>
                      {q.prompt}
                    </h3>
                    <RadioGroup
                      value={answer == null ? '' : String(answer)}
                      onValueChange={(v) => {
                        try {
                          setState((s) =>
                            answerQuestion(s, activeTask.id, i, Number(v)),
                          );
                        } catch (e) {
                          setNotice((e as Error).message);
                        }
                      }}
                      aria-label={`Questão ${i + 1}`}
                      disabled={attempt?.submitted}
                    >
                      {q.options.map((option, j) => (
                        <label
                          key={j}
                          className={`quiz-option ${attempt?.submitted && j === q.answer ? 'correct' : ''} ${attempt?.submitted && j === answer && j !== q.answer ? 'incorrect' : ''}`}
                        >
                          <RadioGroupItem value={String(j)} />
                          <span>{option}</span>
                          {attempt?.submitted && j === q.answer && (
                            <Check size={17} />
                          )}
                        </label>
                      ))}
                    </RadioGroup>
                    {attempt?.submitted && (
                      <p className="answer-explanation">{q.explanation}</p>
                    )}
                  </section>
                );
              })}
              {state.attempts[activeTask.id]?.submitted ? (
                <div className="quiz-result">
                  <AppIcon name="trophy" pack={p.icons} size={30} />
                  <div>
                    <strong>
                      Seu resultado:{' '}
                      {score(
                        activeTask,
                        state.attempts[activeTask.id],
                      )?.toLocaleString('pt-BR')}{' '}
                      / 10
                    </strong>
                    <p>Confira as explicações e continue aprendendo.</p>
                  </div>
                </div>
              ) : (
                <button
                  className="primary-button"
                  disabled={
                    (state.attempts[activeTask.id]?.answers.filter(
                      (x) => x !== null,
                    ).length ?? 0) !== activeTask.questions.length
                  }
                  onClick={submit}
                >
                  Concluir atividade{' '}
                  <span>
                    +50 <Coins size={16} />
                  </span>
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!material}
        onOpenChange={(v) => {
          if (!v) setMaterial(null);
        }}
      >
        <DialogContent className="material-dialog">
          <DialogTitle>{material?.title}</DialogTitle>
          <DialogDescription>
            {material?.subject} · Material de apoio
          </DialogDescription>
          <article className="lesson-content">
            {material?.lesson.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </article>
          <div className="material-actions">
            <button className="secondary-button" onClick={() => window.print()}>
              <Download size={16} /> Imprimir / salvar PDF
            </button>
            <button
              className="primary-button"
              onClick={() => {
                setActiveTask(material);
                setMaterial(null);
              }}
            >
              Praticar <ArrowRight size={17} />
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={eventOpen} onOpenChange={setEventOpen}>
        <DialogContent>
          <DialogTitle>Novo evento</DialogTitle>
          <DialogDescription>
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', {
              dateStyle: 'long',
            })}
          </DialogDescription>
          <form className="event-form" onSubmit={addEvent}>
            <label className="form-label">
              O que você quer lembrar?
              <input
                className="text-input"
                required
                maxLength={160}
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Ex.: Estudar para a prova"
              />
            </label>
            <label className="form-label">
              Horário
              <input
                className="text-input"
                type="time"
                required
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
              />
            </label>
            <button className="primary-button">
              <Plus size={17} /> Adicionar evento
            </button>
          </form>
        </DialogContent>
      </Dialog>
      {notice && (
        <output className="toast">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Fechar aviso"
            onClick={() => setNotice('')}
          >
            <X size={16} />
          </button>
        </output>
      )}
    </div>
  );
}
