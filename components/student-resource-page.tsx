'use client';

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Gamepad2,
  Headphones,
  Library,
  NotebookTabs,
} from 'lucide-react';

type ResourceKey = 'exams' | 'speak' | 'matific' | 'platform' | 'books';

const resourceInfo: Record<
  ResourceKey,
  { label: string; description: string; Icon: typeof BookOpen; tone: string }
> = {
  exams: {
    label: 'Provas',
    description: 'Acompanhe as provas liberadas pelo professor nesta sala.',
    Icon: NotebookTabs,
    tone: 'purple',
  },
  speak: {
    label: 'Speak',
    description: 'Pratique escuta e fala no seu ritmo de aprendizagem.',
    Icon: Headphones,
    tone: 'blue',
  },
  matific: {
    label: 'Matific',
    description: 'Um espaço para desafios de matemática e raciocínio.',
    Icon: Gamepad2,
    tone: 'green',
  },
  platform: {
    label: 'Plataforma',
    description: 'Acesse os recursos digitais compartilhados pela sua turma.',
    Icon: Gamepad2,
    tone: 'indigo',
  },
  books: {
    label: 'E-books',
    description: 'Leia materiais complementares indicados para seus estudos.',
    Icon: Library,
    tone: 'pink',
  },
};

export function StudentResourcePage({
  resource,
  hasConnectedClass,
  onBack,
  onTasks,
}: {
  resource: ResourceKey;
  hasConnectedClass: boolean;
  onBack: () => void;
  onTasks: () => void;
}) {
  const info = resourceInfo[resource];
  const Icon = info.Icon;
  const isExam = resource === 'exams';

  return (
    <section className="student-resource-page">
      <div className={`student-resource-hero ${info.tone}`}>
        <span className="student-resource-icon" aria-hidden="true">
          <Icon />
        </span>
        <div>
          <span className="eyebrow">SALA DO ALUNO</span>
          <h2>{info.label}</h2>
          <p>{info.description}</p>
        </div>
      </div>

      <div className="student-resource-card card">
        <span className="student-resource-card-icon" aria-hidden="true">
          {isExam ? <NotebookTabs /> : <CheckCircle2 />}
        </span>
        <div>
          <h3>
            {isExam
              ? hasConnectedClass
                ? 'Nenhuma prova publicada ainda.'
                : 'Suas provas aparecerão aqui.'
              : 'Este espaço está pronto para receber novos conteúdos.'}
          </h3>
          <p>
            {isExam
              ? 'Quando o professor publicar uma prova, ela ficará disponível nesta área com prazo e instruções.'
              : 'Assim que este recurso for conectado à sua turma, você encontrará o conteúdo e poderá abrir tudo por aqui.'}
          </p>
        </div>
      </div>

      <div className="student-resource-actions">
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={16} /> Voltar para minha sala
        </button>
        <button className="primary-button" onClick={onTasks}>
          Ver atividades <ArrowRight size={16} />
        </button>
      </div>

      {!isExam && (
        <p className="student-resource-note">
          <ExternalLink size={14} /> O conteúdo será liberado pelo professor ou
          pela integração da escola.
        </p>
      )}
    </section>
  );
}

export type { ResourceKey };
