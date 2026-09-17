-- Fase 7: acesso direto somente para leitura protegida por RLS.
-- Escritas permanecem concentradas nas RPCs SECURITY DEFINER autorizadas.

revoke all on table
  public.pedagogical_resources,
  public.pedagogical_resource_versions,
  public.remediation_programs,
  public.learning_journeys,
  public.learning_journey_versions,
  public.learning_journey_steps,
  public.learning_journey_prerequisites,
  public.learning_journey_assignments,
  public.learning_journey_students,
  public.learning_journey_step_progress,
  public.pedagogical_evidence,
  public.pedagogical_recommendations,
  public.ai_pedagogical_suggestions,
  public.reading_fluency_activities,
  public.reading_fluency_sessions,
  public.equity_group_definitions,
  public.equity_group_members
from public, anon, authenticated;

grant select on table
  public.pedagogical_resources,
  public.pedagogical_resource_versions,
  public.remediation_programs,
  public.learning_journeys,
  public.learning_journey_versions,
  public.learning_journey_steps,
  public.learning_journey_prerequisites,
  public.learning_journey_assignments,
  public.learning_journey_students,
  public.learning_journey_step_progress,
  public.pedagogical_evidence,
  public.pedagogical_recommendations,
  public.ai_pedagogical_suggestions,
  public.reading_fluency_activities,
  public.reading_fluency_sessions,
  public.equity_group_definitions,
  public.equity_group_members
to authenticated;

revoke all on table private.journey_progress_operations from public, anon, authenticated;
