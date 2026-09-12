'use client';

import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, ChevronRight, Clock3, Coins, SlidersHorizontal, UserRound, GraduationCap } from 'lucide-react';
import { ClipboardTextIcon, BookOpenIcon, ChatCircleDotsIcon, GraduationCapIcon, GameControllerIcon, YoutubeLogoIcon } from '@phosphor-icons/react';
import { StudentCharacter } from './student-character';
import type { LearningPathStep } from './student-learning-path';
import type { Preferences } from '@/lib/classroom';

export function StudentHome({ name, preferences, earned, possible, steps, calendar, onNavigate, onClassroom, onTeacher, onCustomize, onActivity }: {
  name:string; preferences:Preferences; earned:number; possible:number; steps:LearningPathStep[];
  calendar:ReactNode;
  onNavigate:(view:string)=>void; onClassroom:()=>void; onTeacher:()=>void;
  onCustomize:(tab?:string)=>void; onActivity:(id:string)=>void;
}) {
  const firstName = name.split(' ')[0];
  const links = [
    {label:'Tarefas',view:'tasks',Icon:ClipboardTextIcon,tone:'gold'},
    {label:'Provas',view:'resource:exams',Icon:BookOpenIcon,tone:'purple'},
    {label:'Speak',view:'resource:speak',Icon:ChatCircleDotsIcon,tone:'blue'},
    {label:'Matific',view:'resource:matific',Icon:GraduationCapIcon,tone:'green'},
    {label:'Plataforma',view:'resource:platform',Icon:GameControllerIcon,tone:'indigo'},
    {label:'E-books',view:'resource:books',Icon:YoutubeLogoIcon,tone:'pink'},
  ];
  return <div className="student-home-content">
    <header className="student-home-header">
      <div className="student-home-brand">Aprendê</div>
      <div className="student-home-actions">
        <button aria-label="Minha turma e minha conta" title="Minha turma" onClick={onClassroom}><UserRound/></button>
        <button className="student-home-teacher" aria-label="Entrar como professor" title="Modo professor" onClick={onTeacher}><GraduationCap/></button>
        <button className="student-home-points" aria-label={`${earned} de ${possible} pontos. Ver meu boletim`} onClick={()=>onNavigate('grades')}><Coins/><span>{earned}/{possible}<small>pts</small></span></button>
        <button aria-label="Personalizar personagem e banner" title="Personalizar" onClick={()=>onCustomize('profile')}><SlidersHorizontal/></button>
      </div>
      <div className="student-home-breadcrumb">Sala do Aluno <ChevronRight/> Minha sala</div>
      <h1>Olá, {firstName}!</h1>
    </header>
    <section className={`student-journey-banner journey-${preferences.banner}`} aria-label="Sua jornada">
      <svg className="journey-landscape" viewBox="0 0 1120 300" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 85Q60 76 107 183L0 232Z" fill="white" opacity=".36"/><path d="M1120 50Q1068 44 1015 137L1120 130Z" fill="white" opacity=".28"/>
        <path d="M0 177Q55 144 140 201T338 232Q516 140 671 300H0Z" fill="currentColor" opacity=".55"/>
        <path d="M1120 201Q1017 185 920 300H1120Z" fill="currentColor" opacity=".55"/>
      </svg>
      <div className="journey-portrait"><StudentCharacter preferences={preferences}/></div>
      <div className="journey-message"><h2>Continue<br/>sua jornada,<br/>{firstName}!</h2><p>Grandes conquistas<br/>te esperam! <span aria-hidden="true">👑</span></p></div>
    </section>
    <nav className="student-home-shortcuts" aria-label="Atalhos da sala">
      {links.map(({label,view,Icon,tone})=><button key={view} className={`student-home-shortcut ${tone}`} onClick={()=>onNavigate(view)}><Icon weight="fill" aria-hidden="true"/><strong>{label}</strong><ArrowRight aria-hidden="true"/></button>)}
    </nav>
    <section className="student-home-assignments" aria-labelledby="student-home-assignments-title">
      <header>
        <div>
          <span className="student-home-assignments-icon" aria-hidden="true"><ClipboardTextIcon weight="fill"/></span>
          <span><small>ATIVIDADES DA TURMA</small><h2 id="student-home-assignments-title">Próximas atividades</h2></span>
        </div>
        <button className="student-home-view-all" onClick={()=>onNavigate('tasks')}>Ver todas <ArrowRight aria-hidden="true"/></button>
      </header>
      {steps.length ? <div className="student-home-assignment-list">
        {steps.slice(0,2).map((step,index)=><button key={step.id} onClick={()=>onActivity(step.id)}>
          <span className={`student-home-assignment-status${step.completed?' completed':''}`} aria-hidden="true">{step.completed?<CheckCircle2/>:<Clock3/>}</span>
          <span><small>TAREFA {index+1}</small><strong>{step.title}</strong><em>{step.completed?'Entregue':'Aguardando você'}</em></span>
          <ArrowRight aria-hidden="true"/>
        </button>)}
      </div> : <button className="student-home-assignment-empty" onClick={()=>onNavigate('tasks')}>
        <span className="student-home-assignment-status" aria-hidden="true"><Clock3/></span>
        <span><strong>Nenhuma atividade pendente</strong><small>As tarefas aparecem aqui quando o professor enviar.</small></span>
        <ArrowRight aria-hidden="true"/>
      </button>}
    </section>
    <div className="student-home-calendar">{calendar}</div>
  </div>;
}
