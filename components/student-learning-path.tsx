'use client';

import { ArrowRight, Check, LockKeyhole, Map, Star } from 'lucide-react';
import type { Preferences } from '@/lib/classroom';
import { StudentCharacter } from '@/components/student-character';

export type LearningPathStep = {
  id: string;
  title: string;
  completed: boolean;
};

export function StudentLearningPath({
  preferences,
  steps,
  onOpen,
}: {
  preferences: Preferences;
  steps: LearningPathStep[];
  onOpen: () => void;
}) {
  const completed = steps.filter((step) => step.completed).length;
  const total = steps.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const activeIndex = total ? Math.min(completed, total - 1) : 0;

  return (
    <section className="learning-path" aria-labelledby="learning-path-title">
      <div className="learning-path-heading">
        <span className="learning-path-icon">
          <Map size={24} />
        </span>
        <div>
          <span className="eyebrow">TRILHA DO ALUNO</span>
          <h2 id="learning-path-title">Cada missão leva você mais longe</h2>
          <p>Conclua as atividades da turma e avance até o tesouro.</p>
        </div>
        <button className="text-button" onClick={onOpen}>
          Ver atividades <ArrowRight size={15} />
        </button>
      </div>

      {total ? (
        <div
          className="learning-path-road"
          style={{ '--trail-progress': `${progress}%` } as React.CSSProperties}
        >
          <div className="learning-path-line" aria-hidden="true">
            <i />
          </div>
          {steps.slice(0, 5).map((step, index) => {
            const current = index === activeIndex && !step.completed;
            const locked = index > activeIndex;
            return (
              <button
                key={step.id}
                className={`learning-path-step${step.completed ? ' completed' : ''}${current ? ' current' : ''}`}
                onClick={onOpen}
                aria-label={`${step.title}: ${step.completed ? 'concluída' : locked ? 'bloqueada' : 'próxima atividade'}`}
              >
                {step.completed ? (
                  <Check size={19} />
                ) : locked ? (
                  <LockKeyhole size={17} />
                ) : (
                  <Star size={18} />
                )}
                <span>{step.title}</span>
              </button>
            );
          })}
          <div
            className="learning-path-character"
            style={
              {
                '--trail-position': `${Math.max(5, Math.min(91, total === 1 ? 8 : (activeIndex / (Math.min(total, 5) - 1)) * 86 + 5))}%`,
              } as React.CSSProperties
            }
          >
            <StudentCharacter preferences={preferences} size="trail" />
          </div>
          <span className="learning-path-treasure" aria-label="Objetivo final">
            🏆
          </span>
        </div>
      ) : (
        <button className="learning-path-empty" onClick={onOpen}>
          <StudentCharacter preferences={preferences} size="trail" />
          <span>
            <strong>Sua trilha está pronta.</strong> A primeira etapa aparece
            quando o professor enviar uma atividade.
          </span>
          <ArrowRight size={19} />
        </button>
      )}

      <div className="learning-path-progress">
        <Star size={19} />
        <div>
          <span>
            <strong>Seu progresso</strong>
            <b>
              {completed}/{total} atividades
            </b>
          </span>
          <div
            role="progressbar"
            aria-label="Progresso da trilha"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
