/* Shared, deterministic rules for the six-level game. */
(function(root){
  const thresholds = [30, 50, 70, 90, 120, 150];
  const questionCount = level => [3,3,3,4,4,5][level-1];
  const passCount = level => [2,2,2,3,3,3][level-1];
  const fresh = () => ({version:2, level:1, score:0, target:30, failures:0, weak:[], phase:'swim', quiz:null, seen:[], sound:true});
  function restore(raw){
    try {
      const p = JSON.parse(raw);
      if (!p || ![1,2].includes(p.version) || !Number.isInteger(p.level) || p.level < 1 || p.level > thresholds.length) return fresh();
      const s = fresh(); s.level=p.level;
      s.failures=Number.isInteger(p.failures) ? Math.max(0, Math.min(2,p.failures)) : 0;
      s.target=thresholds[s.level-1]+s.failures*10;
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
      if(p.phase==='quiz' && s.phase==='ready' && q && Array.isArray(q.questions) && q.questions.length===questionCount(s.level) && q.questions.every(x=>x && typeof x.prompt==='string' && typeof x.answer==='string' && typeof x.explanation==='string' && ['chinese','english','math'].includes(x.subject) && Array.isArray(x.options) && x.options.length>=3 && x.options.every(o=>typeof o==='string') && x.options.includes(x.answer)) && Number.isInteger(q.index) && q.index>=0 && q.index<q.questions.length && Array.isArray(q.answers) && q.answers.length===q.index+Number(q.result!==null) && q.answers.every(x=>typeof x==='boolean') && (q.result===null || typeof q.result==='boolean')) {
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
  function begin(s,questions){
    if(s.phase!=='ready'||questions.length!==questionCount(s.level))return false;
    s.phase='quiz';s.quiz={questions,index:0,answers:[],result:null};
    s.seen=[...s.seen,...questions.map(q=>q.id)].slice(-30);return true;
  }
  function answer(s,value){
    if(s.phase!=='quiz'||s.quiz.result!==null)return;
    const q=s.quiz, current=q.questions[q.index];
    q.result=value===current.answer;q.answers.push(q.result);
    if(!q.result&&!s.weak.includes(current.subject))s.weak.push(current.subject);
  }
  function advance(s){
    if(s.phase!=='quiz'||s.quiz.result===null)return null;
    const q=s.quiz;
    if(q.index<q.questions.length-1){q.index++;q.result=null;return 'question';}
    const passed=q.answers.filter(Boolean).length>=passCount(s.level)||s.failures>=2;
    s.quiz=null;
    if(passed){
      if(s.level===thresholds.length){s.phase='complete';return 'complete';}
      s.level++;s.score=0;s.target=thresholds[s.level-1];s.failures=0;s.weak=[];s.phase='swim';return 'level';
    }
    s.failures++;s.target=thresholds[s.level-1]+s.failures*10;s.phase='swim';return 'retry';
  }
  const api={thresholds,questionCount,passCount,fresh,restore,eat,hit,begin,answer,advance};
  if(typeof module!=='undefined')module.exports=api;else root.FishGame=api;
})(globalThis);
