/* Shared, deterministic rules for the six-level game. */
(function(root){
  const thresholds = [30, 50, 70, 90, 120, 150];
  const questionCount = level => [3,3,3,4,4,5][level-1];
  const errors = q => q.answers.filter(x=>!x).length;
  const validQuestion = x => x && typeof x.prompt==='string' && typeof x.answer==='string' && typeof x.explanation==='string' && ['chinese','english','math'].includes(x.subject) && Array.isArray(x.options) && x.options.length>=3 && x.options.every(o=>typeof o==='string') && x.options.includes(x.answer);
  const fresh = () => ({version:3, level:1, score:0, target:30, failures:0, weak:[], phase:'swim', quiz:null, seen:[], sound:true});
  function restore(raw){
    try {
      const p = JSON.parse(raw);
      if (!p || ![1,2,3].includes(p.version) || !Number.isInteger(p.level) || p.level < 1 || p.level > thresholds.length) return fresh();
      const s = fresh(); s.level=p.level;
      s.failures=Number.isInteger(p.failures) ? Math.max(0, Math.min(2,p.failures)) : 0;
      s.target=thresholds[s.level-1];
      s.score=Number.isFinite(p.score) ? Math.max(0,Math.min(s.target,p.score)) : 0;
      s.sound=p.sound!==false;
      s.weak=Array.isArray(p.weak) ? p.weak.filter(x=>['chinese','english','math'].includes(x)) : [];
      s.seen=Array.isArray(p.seen) ? p.seen.filter(x=>typeof x==='string').slice(-30) : [];
      s.phase=s.score>=s.target?'ready':'swim';
      if(p.version===1 && p.phase==='complete' && s.level===3 && s.score===s.target){
        s.level=4;s.score=0;s.target=thresholds[3];s.failures=0;s.weak=[];s.phase='swim';return s;
      }
      if(p.phase==='complete' && s.level===thresholds.length && s.score===s.target) s.phase='complete';
      const q=p.quiz;
      if(p.version===3 && p.phase==='quiz' && s.phase==='ready' && q && Array.isArray(q.questions) && q.questions.every(validQuestion) && Array.isArray(q.answers) && q.answers.every(x=>typeof x==='boolean') && errors(q)<=3 && q.questions.length===questionCount(s.level)+2*errors(q) && Number.isInteger(q.index) && q.index>=0 && q.index<q.questions.length && q.answers.length===q.index+Number(q.result!==null) && (q.result===null || typeof q.result==='boolean') && (q.selected===null || typeof q.selected==='string') && q.reserve && ['chinese','english','math'].every(subject=>Array.isArray(q.reserve[subject]) && q.reserve[subject].length===6-2*q.questions.slice(0,q.answers.length).filter((item,i)=>item.subject===subject&&!q.answers[i]).length && q.reserve[subject].every(x=>validQuestion(x)&&x.subject===subject))) {
        s.quiz=q; s.phase='quiz';
      }
      return s;
    } catch {return fresh();}
  }
  function eat(s,points){
    if(s.phase!=='swim') return;
    s.score=Math.min(s.target,s.score+points);
    if(s.score>=s.target)s.phase='ready';
  }
  function hit(s){if(s.phase==='swim')s.score=Math.max(0,s.score*.8);}
  function begin(s,questions,reserve){
    if(s.phase!=='ready'||questions.length!==questionCount(s.level)||!reserve||!['chinese','english','math'].every(subject=>Array.isArray(reserve[subject])&&reserve[subject].length===6&&reserve[subject].every(x=>validQuestion(x)&&x.subject===subject)))return false;
    s.phase='quiz';s.quiz={questions,reserve,index:0,answers:[],result:null,selected:null};
    s.seen=[...s.seen,...questions.map(q=>q.id)].slice(-30);return true;
  }
  function answer(s,value){
    if(s.phase!=='quiz'||s.quiz.result!==null)return;
    const q=s.quiz, current=q.questions[q.index];
    q.selected=value;q.result=value===current.answer;q.answers.push(q.result);
    if(!q.result){const extra=q.reserve[current.subject].splice(0,2);q.questions.push(...extra);s.seen=[...s.seen,...extra.map(x=>x.id)].slice(-30);}
    if(!q.result&&!s.weak.includes(current.subject))s.weak.push(current.subject);
  }
  function advance(s){
    if(s.phase!=='quiz'||s.quiz.result===null)return null;
    const q=s.quiz;
    if(errors(q)>=3){
      s.quiz=null;s.score=0;s.target=thresholds[s.level-1];s.failures=Math.min(2,s.failures+1);s.phase='swim';return 'retry';
    }
    if(q.index<q.questions.length-1){q.index++;q.result=null;q.selected=null;return 'question';}
    s.quiz=null;
    if(s.level===thresholds.length){s.phase='complete';return 'complete';}
    s.level++;s.score=0;s.target=thresholds[s.level-1];s.failures=0;s.weak=[];s.phase='swim';return 'level';
  }
  const api={thresholds,questionCount,errors,fresh,restore,eat,hit,begin,answer,advance};
  if(typeof module!=='undefined')module.exports=api;else root.FishGame=api;
})(globalThis);
