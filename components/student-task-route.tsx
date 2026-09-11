'use client';
import { Check, Flag, Star, ArrowRight, Trophy } from 'lucide-react';
import { routeRewards } from '@/lib/student-route';
import { StudentCharacter } from './student-character';
import type { Preferences } from '@/lib/classroom';
export type StudentWork = {id:string;title:string;subject:string;instructions:string;created_at:string;due_at:string|null;points:number;kind?:'task'|'exam'};
export type StudentResult = {assignment_id:string;status:string;score:number|null;feedback:string|null};
export function subjectTone(subject:string) {
 const s=subject.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return s.includes('mat')?'math':s.includes('ing')?'english':s.includes('hist')?'history':'language';
}
export function StudentTaskRoute({name,preferences,work,results,onOpen,exams=false}:{name:string;preferences:Preferences;work:StudentWork[];results:StudentResult[];onOpen:(id:string)=>void;exams?:boolean}) {
 const items=[...work].filter(a=>(a.kind==='exam')===exams).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
 const rewards=routeRewards(items,results);
 const completed=rewards.completed;
 return <section className="student-route-page">
 {!exams&&<header className={`student-route-banner journey-${preferences.banner}`}><div><small>SUA TRILHA DE TAREFAS</small><h2>{name}</h2><p>Uma lição de cada vez. Continue de onde parou.</p></div><StudentCharacter preferences={preferences}/></header>}
 {!exams&&<div className="student-route-achievements"><Trophy/><strong>{rewards.total} pontos da trilha</strong><span>{completed} de {items.length} tarefas entregues</span><span>{items.length?Math.round(completed/items.length*100):0}% concluído</span></div>}
 <p className="student-route-help">{exams?'Provas por matéria, da primeira publicação à mais recente.':'Comece pelas primeiras tarefas enviadas. Toque em uma etapa para ver as orientações.'}</p>
 <div className={exams?'student-exam-list':'student-task-road'}>
 {items.map((a,i)=>{const done=results.some(s=>s.assignment_id===a.id&&s.status==='submitted');return <article key={a.id} className={`student-route-stop subject-${subjectTone(a.subject)} ${done?'complete':''}`}>
 {!exams&&<span className="route-marker" aria-hidden="true">{done?<Check/>:i+1}</span>}
 <details><summary><span className="route-subject">{a.subject}</span><h3>{a.title}</h3><span className="route-date">Enviada em {new Date(a.created_at).toLocaleDateString('pt-BR')}{a.due_at&&` · Entrega ${new Date(a.due_at).toLocaleDateString('pt-BR')}`}</span><strong className="route-status">{done?'Entregue':exams?'Abrir orientações':'+10 pontos · Abrir'} <ArrowRight size={16}/></strong></summary>
 <div className="route-instructions"><p>{a.instructions||'Abra a atividade para registrar sua resposta.'}</p><button className="primary-button" onClick={()=>onOpen(a.id)}>{done?'Ver minha entrega':exams?'Responder prova':'Responder tarefa'} <ArrowRight size={16}/></button></div></details>
 </article>})}
 {!items.length&&<div className="student-route-empty"><Star/><h3>{exams?'Nenhuma prova publicada':'Sua trilha começa aqui'}</h3><p>{exams?'As provas enviadas pelo professor aparecerão nesta lista.':'As tarefas da sua turma aparecerão aqui assim que o professor publicar.'}</p></div>}
 {!exams&&items.length>0&&<div className="student-route-finish"><Flag/><strong>{completed===items.length?'Todas as tarefas entregues!':'Conclusão da trilha'}</strong><span>{rewards.bonus?'100 pontos de bônus conquistados':'+100 pontos ao concluir'}</span></div>}
 </div></section>;
}
