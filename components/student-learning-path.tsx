'use client';
import { useEffect, useState } from 'react';
import { Check, LockKeyhole, Star, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { MapTrifoldIcon } from '@phosphor-icons/react';
import type { Preferences } from '@/lib/classroom';
import { StudentCharacter } from './student-character';
import { getLearningPath } from '@/lib/student-learning-path';
export type LearningPathStep = { id:string; title:string; completed:boolean };

export function StudentLearningPath({ preferences, steps, onOpen, onAll }: {
  preferences:Preferences; steps:LearningPathStep[]; onOpen:(id:string)=>void; onAll:()=>void;
}) {
  const path = getLearningPath(steps);
  const [page, setPage] = useState(0);
  useEffect(()=>{ setPage((current)=>Math.min(current,path.pages-1)); },[path.pages]);
  const visible = steps.slice(page*5,page*5+5);
  return <section className="learning-path" aria-labelledby="learning-path-title">
    <header className="learning-path-heading">
      <span className="learning-path-map" aria-hidden="true"><MapTrifoldIcon weight="duotone"/><MapPin/></span>
      <div><h2 id="learning-path-title">Trilha do Aluno</h2><p>Complete as tarefas, acumule pontos<br className="trail-desktop-break"/> e chegue ao tesouro!</p></div>
    </header>
    <div className="learning-path-landscape">
      <svg className="learning-path-route" viewBox="0 0 1000 210" preserveAspectRatio="none" aria-hidden="true"><path d="M85 88C153 22 165 132 252 111S350 92 391 105S481 139 530 103S628 88 670 117S765 147 814 99S870 54 914 91" fill="none" stroke="#82542e" strokeWidth="5" strokeLinecap="round" strokeDasharray="9 18"/></svg>
      <div className="learning-path-start"><StudentCharacter preferences={preferences} size="trail"/><span className="learning-path-start-label">Início</span></div>
      {Array.from({length:5},(_,i)=>{
        const step=visible[i]; const next=step?.id===path.nextId;
        return <div key={step?.id??`future-${i}`} className={`learning-path-node node-${i}${step?.completed?' completed':''}${next?' current':''}`}>
          <button disabled={!step} title={step?.title??'Aguardando uma atividade do professor'} onClick={()=>step&&onOpen(step.id)} aria-label={step?`${step.title}: ${step.completed?'entregue':'abrir atividade'}`:'Etapa futura - aguardando atividade'}>
            {step?.completed?<Check/>:step?<Star/>:<LockKeyhole/>}
          </button>
          <span>{step?`Tarefa ${page*5+i+1}`:'Em breve'}</span>
        </div>;
      })}
      <button className={`learning-path-goal${path.complete?' complete':''}`} onClick={onAll} aria-label={path.complete?'Todas as tarefas entregues. Ver atividades':'Grande objetivo. Ver minhas atividades'}><span>{path.complete?'Conquistado!':<>Grande<br/>objetivo</>}</span></button>
    </div>
    {!steps.length&&<p className="learning-path-empty-note">Sua primeira missão aparece quando o professor enviar uma tarefa.</p>}
    {path.pages>1&&<nav className="learning-path-pagination" aria-label="Etapas da trilha"><button aria-label="Etapas anteriores" disabled={page===0} onClick={()=>setPage(page-1)}><ChevronLeft/></button><span>Etapa {page+1} de {path.pages}</span><button aria-label="Próximas etapas" disabled={page===path.pages-1} onClick={()=>setPage(page+1)}><ChevronRight/></button></nav>}
    <div className="learning-path-progress"><Star className="trail-star"/><div className="trail-progress-main"><strong>Seu progresso</strong><div role="progressbar" aria-label="Progresso da trilha" aria-valuemin={0} aria-valuemax={100} aria-valuenow={path.percent}><i style={{width:`${path.percent}%`}}/></div></div><span className="trail-progress-label"><Star/>{path.completed}/{steps.length} tarefas</span></div>
  </section>;
}
