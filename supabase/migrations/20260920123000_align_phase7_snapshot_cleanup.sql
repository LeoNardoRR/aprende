-- A versão atribuída permanece protegida por learning_journey_assignments.
-- Ao apagar uma jornada de teste sem atribuições, seus registros privados
-- congelados devem acompanhar a versão e a etapa removidas.
alter table private.journey_version_step_validation
  drop constraint journey_version_step_validation_journey_version_id_fkey,
  add constraint journey_version_step_validation_journey_version_id_fkey
    foreign key(journey_version_id) references public.learning_journey_versions(id) on delete cascade;

alter table private.journey_version_step_validation
  drop constraint journey_version_step_validation_step_id_fkey,
  add constraint journey_version_step_validation_step_id_fkey
    foreign key(step_id) references public.learning_journey_steps(id) on delete cascade;
