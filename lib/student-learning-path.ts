export function getLearningPath(steps: {id:string;completed:boolean}[]) {
  const completed=steps.filter(step=>step.completed).length;
  return { completed, percent:steps.length?Math.round(completed/steps.length*100):0,
    complete:steps.length>0&&completed===steps.length,
    nextId:steps.find(step=>!step.completed)?.id??null,
    pages:Math.max(1,Math.ceil(steps.length/5)),
  };
}
