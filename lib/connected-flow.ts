export type PointsAssignment = { id: string; points: number };
export type PointsSubmission = {
  assignment_id: string;
  status: 'draft' | 'submitted';
  score: number | null;
};

export function normalizeClassCode(value: string) {
  return value
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8)
    .toUpperCase();
}

export function isValidClassCode(value: string) {
  return /^[A-Z0-9]{8}$/.test(normalizeClassCode(value));
}

export function calculateConnectedMetrics(
  assignments: PointsAssignment[],
  submissions: PointsSubmission[],
) {
  const possible = assignments.reduce((total, item) => total + item.points, 0);
  const earned = submissions.reduce(
    (total, item) => total + (item.score ?? 0),
    0,
  );
  const delivered = submissions.filter(
    (item) => item.status === 'submitted',
  ).length;
  return { possible, earned, delivered, total: assignments.length };
}

export function canEditSubmission(submission?: {
  status: 'draft' | 'submitted';
  score: number | null;
}) {
  return (
    !submission || (submission.status === 'draft' && submission.score == null)
  );
}

export function connectedSubmissionLabel(submission?: {
  status: 'draft' | 'submitted';
  score: number | null;
}) {
  if (!submission) return 'Aguardando sua resposta';
  if (submission.score != null) return 'Corrigida';
  if (submission.status === 'submitted') return 'Enviada';
  return 'Rascunho';
}

export function friendlySupabaseError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials'))
    return 'E-mail ou senha incorretos.';
  if (normalized.includes('email not confirmed'))
    return 'Confirme seu e-mail antes de entrar.';
  if (normalized.includes('user already registered'))
    return 'Este e-mail já possui uma conta. Use a opção Entrar.';
  if (normalized.includes('password should be'))
    return 'A senha precisa ter pelo menos 8 caracteres.';
  if (normalized.includes('rate limit'))
    return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.';
  if (normalized.includes('invalid class code'))
    return 'Código de turma inválido. Confira os 8 caracteres.';
  if (normalized.includes('only student accounts'))
    return 'Use uma conta de aluno para entrar na turma.';
  if (
    normalized.includes('row-level security') ||
    normalized.includes('permission denied')
  )
    return 'Sua conta não tem permissão para concluir esta ação.';
  return message;
}
