export function routeRewards(items: {id:string}[], results: {assignment_id:string;status:string}[]) {
  const ids=new Set(items.map(item=>item.id));
  const delivered=new Set(results.filter(s=>s.status==='submitted'&&ids.has(s.assignment_id)).map(s=>s.assignment_id));
  const complete=ids.size>0&&delivered.size===ids.size;
  return {completed:delivered.size,lessonPoints:delivered.size*10,bonus:complete?100:0,total:delivered.size*10+(complete?100:0)};
}
