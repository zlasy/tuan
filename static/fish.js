(() => {
  'use strict';
  const $=id=>document.getElementById(id), canvas=$('sea'), ctx=canvas.getContext('2d'), Core=window.FishGame, Art=window.FishArt;
  const KEY='tuan-fish-s1-v1', W=400,H=500, habitats=Art.habitats;
  let state=Core.fresh(), storageOK=true;
  try{state=Core.restore(localStorage.getItem(KEY));}catch{storageOK=false;}
  let running=false,deep=false,loading=false,clock=0,last=0,combo=0,lastEat=-10,invincible=0,goldAt=10;
  let fish=[],predators=[],bubbles=[],floating=[],player={x:200,y:270,vx:0,vy:0},target={x:200,y:270},keys=new Set();
  let quizTime=20,audio;
  const size=()=>21+(state.level-1)*3;
  const pixelRatio=Math.min(3,window.devicePixelRatio||1);
  canvas.width=W*pixelRatio;canvas.height=H*pixelRatio;
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
  const random=(a,b)=>a+Math.random()*(b-a);
  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageOK=false;}
    $('storage-note').textContent=storageOK?'进度自动保存在当前浏览器 · 六海域探险':'浏览器未能保存进度，本次仍可继续游戏。';
  }
  function tone(kind){
    if(!state.sound)return;
    try{
      audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});
      const notes=kind==='eat'?[540,740]:[523,659,784,1046];
      notes.forEach((hz,i)=>{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.09;
        o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.08,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+.18);
        o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.2);
      });
    }catch{}
  }
  function hud(){
    $('level').textContent=state.level;
    $('sea-label').textContent=habitats[state.level-1].label;
    $('route').replaceChildren();
    habitats.forEach((area,i)=>{const stop=document.createElement('span');stop.textContent=String(i+1);stop.title=area.name;stop.setAttribute('aria-label',`${area.name}${i+1<state.level?' 已完成':i+1===state.level?' 当前海域':' 待探索'}`);if(i+1===state.level)stop.setAttribute('aria-current','step');if(i+1<state.level)stop.classList.add('done');$('route').append(stop);});$('area').textContent=habitats[state.level-1].name;
    $('score').textContent=`${Math.floor(state.score)} / ${state.target}`;
    $('growth').max=state.target;$('growth').value=state.score;
    $('shell').hidden=state.phase!=='ready'||!running||loading;
    $('sound').textContent=state.sound?'声音开':'声音关';$('sound').setAttribute('aria-pressed',String(state.sound));
    $('hint').textContent=state.phase==='quiz'?'游动已暂停，安心打开知识贝壳。':state.phase==='ready'?`吃饱了，去开贝壳！${Core.questionCount(state.level)} 题答对 ${Core.passCount(state.level)} 题就能长大。`:deep?'深水成长值 +30% · 水母数量翻倍，小心游！':state.failures?'再吃满成长值，就能重新开贝壳。':'拖动海面游泳，寻找比你小的鱼。';
  }
  function spawn(gold=false){
    const kind=gold?4:Math.floor(random(0,4)),r=size()*[.35,.48,.65,.84,.45][kind];
    const left=Math.random()<.5;
    return {kind,r,x:left?-r:W+r,y:random(55,H-55),vx:(left?1:-1)*[24,34,50,72,57][kind],wave:random(0,7),born:clock};
  }
  function predator(){return {x:random(45,W-45),y:random(65,H-70),r:size()*1.7,phase:random(0,7)};}
  function seed(){
    fish=Array.from({length:10},()=>{const f=spawn();f.x=random(15,W-15);return f;});
    // A safe first bite is placed close to the player.
    fish[0]={...spawn(),kind:0,r:size()*.35,x:245,y:270,vx:-12};
    predators=[];player={x:200,y:270,vx:0,vy:0};target={x:200,y:270};clock=0;goldAt=10;invincible=0;combo=0;lastEat=-10;
    bubbles=Array.from({length:20},()=>({x:random(0,W),y:random(0,H),r:random(1,4),speed:random(7,22)}));
  }
  function cover(title,copy,label='继续游泳'){
    running=false;keys.clear();$('cover-title').textContent=title;$('cover-copy').textContent=copy;$('play').textContent=label;
    $('cover').hidden=false;$('challenge').hidden=true;$('shell').hidden=true;
    $('reset').hidden=state.level===1&&state.score===0&&state.failures===0;
  }
  function pause(){
    if(!running||loading)return;
    cover('歇一会儿，海洋等着你','游动和答题计时都已暂停，回来后从这里继续。');save();
  }
  function play(){
    if(state.phase==='complete'){state=Core.fresh();save();seed();}
    running=true;$('cover').hidden=true;
    if(state.phase==='quiz'){renderQuestion();}else $('challenge').hidden=true;
    hud();canvas.focus({preventScroll:true});
  }
  async function openShell(){
    if(!running||state.phase!=='ready'||loading)return;
    loading=true;running=false;$('shell').hidden=true;
    $('hint').textContent='贝壳里很安全，正在准备小问题…';
    const params=new URLSearchParams({level:state.level,attempt:state.failures,weak:state.weak.join(','),exclude:state.seen.join(',')});
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch('/api/games/fish/questions?'+params,{signal:controller.signal});
      if(!response.ok)throw Error();
      const {questions}=await response.json();
      if(!Array.isArray(questions)||questions.length!==Core.questionCount(state.level))throw Error();
      Core.begin(state,questions);quizTime=20;save();
      if(document.hidden)cover('贝壳准备好啦','回来后继续答题。','开始答题');
      else{running=true;renderQuestion();}
    }catch{
      if(document.hidden)cover('贝壳还没准备好','回来后可重新打开贝壳。');
      else running=true;
      $('hint').textContent='题目暂时没送到，再点贝壳试试，成长值已保留。';
    }finally{clearTimeout(timeout);loading=false;$('shell').hidden=state.phase!=='ready'||!running;}
  }
  const subjectNames={chinese:'🌱 识字',english:'🔤 英文',math:'🧮 数学'};
  function renderQuestion(){
    const q=state.quiz,item=q.questions[q.index];
    hud();
    $('challenge').hidden=false;$('cover').hidden=true;$('shell').hidden=true;
    $('subject').textContent=`${subjectNames[item.subject]} · ${q.index+1} / ${q.questions.length}`;
    $('question').textContent=item.prompt;$('options').replaceChildren();
    item.options.forEach(option=>{
      const b=document.createElement('button');b.textContent=option;b.setAttribute('aria-label','选择 '+option);
      b.addEventListener('click',()=>choose(option));$('options').append(b);
    });
    if(q.result!==null){showFeedback();}
    else{$('feedback').textContent=state.failures>=2?'这次完成所有题目就能开门，慢慢想。':'选一个答案，打开知识贝壳。';$('continue').hidden=true;}
    $('timer').textContent=q.result!==null?'已作答':`${Math.ceil(quizTime)} 秒`;
  }
  function choose(value){
    if(!running||state.phase!=='quiz'||state.quiz.result!==null)return;
    Core.answer(state,value);save();showFeedback();
  }
  function showFeedback(){
    const q=state.quiz,item=q.questions[q.index];
    [...$('options').children].forEach(b=>{b.disabled=true;if(b.textContent===item.answer)b.classList.add('correct');});
    $('feedback').textContent=q.result?'答对啦！'+item.explanation:`一起记住：${item.answer}。${item.explanation}`;
    $('timer').textContent='已作答';$('continue').hidden=false;$('continue').disabled=false;
    $('continue').textContent=q.index===q.questions.length-1?'打开贝壳':'下一题';
  }
  function continueQuiz(){
    if(!running)return;
    const result=Core.advance(state);save();
    if(result==='question'){quizTime=20;renderQuestion();return;}
    if(!result)return;
    $('challenge').hidden=true;
    if(result==='retry')cover('再练一次，就更熟练','成长值一点没少！再吃 10 点成长值，换一批题。'+(state.failures===2?'下次完成所有题目就能开门。':''));
    else if(result==='complete'){tone('level');cover('六关完成，海洋探险家！','你从珊瑚浅滩游到了海底火山，也打开了识字、英文和数学贝壳。下次再来探险！','再玩一局');}
    else{tone('level');seed();$('ocean').classList.remove('grow');void $('ocean').offsetWidth;$('ocean').classList.add('grow');cover(`长大啦！来到第 ${state.level} 关`,'身体更大了，能吃的鱼也更多了。准备好继续寻找知识贝壳了吗？','继续探险');}
    hud();
  }
  function update(dt){
    if(state.phase==='quiz'){
      if(state.quiz.result===null){quizTime=Math.max(0,quizTime-dt);$('timer').textContent=`${Math.ceil(quizTime)} 秒`;if(quizTime===0)choose(null);}
      return;
    }
    if(!['swim','ready'].includes(state.phase))return;
    clock+=dt;invincible=Math.max(0,invincible-dt);
    if(clock>15){const count=(deep?2:1)*Math.ceil(state.level/2);while(predators.length<count)predators.push(predator());predators.length=count;}
    if(clock>=goldAt){fish.push(spawn(true));goldAt=clock+10;}
    let kx=Number(keys.has('ArrowRight')||keys.has('d'))-Number(keys.has('ArrowLeft')||keys.has('a'));
    let ky=Number(keys.has('ArrowDown')||keys.has('s'))-Number(keys.has('ArrowUp')||keys.has('w'));
    if(kx||ky)target={x:player.x+kx*100,y:player.y+ky*100};
    const dx=target.x-player.x,dy=target.y-player.y,dist=Math.hypot(dx,dy),speed=Math.min(155,dist*4),blend=Math.min(1,dt*9);
    player.vx+=(dx/(dist||1)*speed-player.vx)*blend;player.vy+=(dy/(dist||1)*speed-player.vy)*blend;
    player.x=Math.max(size(),Math.min(W-size(),player.x+player.vx*dt));player.y=Math.max(size()+20,Math.min(H-size()-15,player.y+player.vy*dt));
    for(const f of fish){
      f.x+=f.vx*dt;f.y+=Math.sin(clock*2+f.wave)*dt*10;
      if(Math.hypot(f.x-player.x,f.y-player.y)<size()+f.r*.5 && f.r<size() && state.phase==='swim'){
        combo=clock-lastEat<=3?Math.min(4,combo+1):1;lastEat=clock;
        const multiplier=[1,1,1.2,1.5,2][combo],points=[1,1,2,4,8][f.kind]*multiplier*(deep?1.3:1);
        Core.eat(state,points);f.eaten=true;tone('eat');floating.push({x:f.x,y:f.y,text:'+'+Number(points.toFixed(1)),life:1});save();hud();
      }
    }
    fish=fish.filter(f=>!f.eaten && f.x>-60&&f.x<W+60 && (f.kind!==4||clock-f.born<8));
    while(fish.filter(f=>f.kind!==4).length<10)fish.push(spawn());
    for(const p of predators){
      p.x+=Math.sin(clock*.6+p.phase)*dt*22;p.y+=Math.cos(clock*.5+p.phase)*dt*16;
      p.x=Math.max(p.r,Math.min(W-p.r,p.x));p.y=Math.max(p.r+40,Math.min(H-p.r,p.y));
      if(invincible===0&&state.phase==='swim'&&Math.hypot(p.x-player.x,p.y-player.y)<p.r*.65+size()*.65){
        Core.hit(state);invincible=1.5;combo=0;lastEat=-10;floating.push({x:player.x,y:player.y,text:'躲开大水母 · −20%',life:1.5});save();hud();
      }
    }
    for(const b of bubbles){b.y-=b.speed*dt;if(b.y<-5){b.y=H+5;b.x=random(0,W);}}
    for(const f of floating){f.y-=25*dt;f.life-=dt;}floating=floating.filter(f=>f.life>0);
    $('combo').textContent=clock-lastEat<=3&&combo>1?`连吃 ×${[1,1,1.2,1.5,2][combo]}`:'';
  }
  function draw(){
    Art.background(ctx,state.level,deep,clock,bubbles);
    for(const f of fish)Art.fish(ctx,f.x,f.y,f.r,f.kind,Math.sign(f.vx),clock+f.wave);
    for(const p of predators)Art.jelly(ctx,p,clock,state.level);
    ctx.globalAlpha=invincible>0?.45:1;
    Art.fish(ctx,player.x,player.y,size(),0,player.vx< -5?-1:1,clock,true);ctx.globalAlpha=1;
    ctx.font='bold 14px sans-serif';ctx.textAlign='center';
    for(const f of floating){ctx.globalAlpha=Math.min(1,f.life);ctx.fillStyle='#fffbd0';ctx.fillText(f.text,f.x,f.y);}ctx.globalAlpha=1;
  }
  function frame(time){const dt=Math.min(.05,(time-last)/1000||0);last=time;if(running)update(dt);draw();requestAnimationFrame(frame);}
  let pointer=null;
  function aim(e){const r=canvas.getBoundingClientRect();target={x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};}
  canvas.addEventListener('pointerdown',e=>{if(!running||state.phase==='quiz')return;pointer=e.pointerId;canvas.setPointerCapture(pointer);aim(e);});
  canvas.addEventListener('pointermove',e=>{if(e.pointerId===pointer)aim(e);});
  const release=()=>{pointer=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  canvas.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)){e.preventDefault();keys.add(e.key);}});
  window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>{keys.clear();pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',save);
  $('play').addEventListener('click',play);$('pause').addEventListener('click',pause);$('shell').addEventListener('click',openShell);$('continue').addEventListener('click',continueQuiz);
  $('depth').addEventListener('click',()=>{if(!running||!['swim','ready'].includes(state.phase))return;deep=!deep;$('depth').setAttribute('aria-pressed',String(deep));$('depth').textContent=deep?'☀️ 返回浅水':'🌊 下潜深水';hud();});
  $('sound').addEventListener('click',()=>{state.sound=!state.sound;save();hud();});
  $('reset').addEventListener('click',()=>{if(!window.confirm('重新开始会清除本次吞吞鱼进度，确定吗？'))return;state=Core.fresh();save();seed();play();});
  seed();hud();save();
  if(state.phase==='complete')cover('六关完成，海洋探险家！','知识贝壳都打开了，再来一次海洋探险吧。','再玩一局');
  else if(state.level>1||state.score>0||state.phase==='quiz')cover('欢迎回来，小探险家',`已保存第 ${state.level} 关的进度，继续打开你的知识贝壳。`,'继续探险');
  requestAnimationFrame(frame);
})();
