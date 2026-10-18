(() => {
  'use strict';
  const $=id=>document.getElementById(id), L=window.Lighthouse;
  const books=JSON.parse($('book-data').textContent), vocab=JSON.parse($('vocab-data').textContent);
  const key='little-lighthouse-v1', names=['蓝海','绿野','金山'];
  let state=L.empty(), level=1, favoritesOnly=false, current=null, together=false, speaking=0;
  let speechTimer;
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const notify=text=>{$('notice').textContent=text;$('notice').hidden=!text;};
  try {state=L.restore(localStorage.getItem(key),books);} catch {notify('浏览器暂时不能保存进度，本次仍可阅读；关闭页面后进度可能丢失。');}
  const save=()=>{try {localStorage.setItem(key,JSON.stringify(state));}catch {notify('进度暂时无法保存。你可以继续阅读，但离开页面后本次进度可能丢失。');}};
  const find=id=>books.find(b=>b.id===id);
  function element(tag,text,className) {const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
  function stopSpeech() {
    speaking++;clearTimeout(speechTimer);window.speechSynthesis?.cancel();
    $('listen').textContent='🔊 听这一页';document.querySelectorAll('.word.active').forEach(n=>n.classList.remove('active'));
  }
  function say(text,lang='en-US',word=null) {
    stopSpeech();
    if(!window.speechSynthesis||!window.SpeechSynthesisUtterance) {notify('这台设备暂不支持朗读，可以继续看图阅读。请换用支持语音的浏览器听范读。');return;}
    const voices=speechSynthesis.getVoices();
    const voice=voices.find(v=>v.lang.toLowerCase().startsWith(lang.slice(0,2))&&v.localService)||voices.find(v=>v.lang.toLowerCase().startsWith(lang.slice(0,2)));
    if(lang==='en-US'&&!voice) {notify('暂未找到英文语音。请在设备语音设置中安装英文声音后重试；仍可看图阅读。');return;}
    const token=speaking, u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=lang==='en-US'?state.settings.rate:1;if(voice)u.voice=voice;
    const done=()=>{if(token!==speaking)return;clearTimeout(speechTimer);$('listen').textContent='🔊 听这一页';word?.classList.remove('active');};
    u.onstart=()=>{clearTimeout(speechTimer);if(token===speaking){word?.classList.add('active');if(lang==='en-US'&&!word)$('listen').textContent='■ 停止范读';}};
    u.onend=done;u.onerror=event=>{done();if(token===speaking&&!['interrupted','canceled'].includes(event.error))notify('这次朗读没有成功。可以再点一次，或检查设备的英文语音设置。');};
    speechTimer=setTimeout(()=>{if(token===speaking){stopSpeech();notify('语音未能启动，请检查设备声音与英文语音设置，再试一次。');}},7000);
    speechSynthesis.speak(u);
  }
  function show(id) {
    stopSpeech();for(const panel of ['home','reader','celebration'])$(panel).hidden=panel!==id;
    window.scrollTo({top:0,behavior:'instant'});
  }
  function applySettings() {
    document.body.classList.toggle('contrast',state.settings.contrast);
    document.documentElement.style.setProperty('--reading-size',state.settings.size);
    $('rate').value=state.settings.rate;$('font-size').value=state.settings.size;$('contrast').checked=state.settings.contrast;
  }
  function renderHome() {
    const lit=books.filter(b=>state.books[b.id]?.stars).length;
    $('lit-count').textContent=lit;$('tower-lights').replaceChildren(...books.map(b=>element('i',undefined,state.books[b.id]?.stars?'on':'')));
    $('tower-lights').setAttribute('aria-label',`灯塔已点亮 ${lit} 格，共 39 格`);
    $('last-read').textContent=lit?'每一束光，都来自你读过的故事。':'小纸船已经准备好啦';
    const last=find(state.last), p=last&&state.books[last.id];
    $('resume-box').hidden=!last||p.finished;
    if(last)$('resume-title').textContent=`${last.subtitle} · 第 ${p.page+1} / ${last.pages.length} 页`;
    $('shelf-title').textContent=favoritesOnly?'我收藏的小故事':`${names[level-1]}书岛 · 13 本`;
    $('favorites').setAttribute('aria-pressed',String(favoritesOnly));$('favorites').textContent=favoritesOnly?'♥ 返回书岛':'♡ 我的收藏';
    document.querySelectorAll('[data-level]').forEach(b=>b.setAttribute('aria-pressed',String(!favoritesOnly&&Number(b.dataset.level)===level)));
    const list=books.filter(b=>favoritesOnly?state.books[b.id]?.favorite:b.level===level);
    $('book-grid').replaceChildren(...list.map(b=>{
      const progress=state.books[b.id], card=element('button',undefined,'book-card');card.dataset.book=b.id;
      const cover=element('span',b.icon,'book-cover');cover.setAttribute('aria-hidden','true');card.append(cover);
      const info=element('span',undefined,'book-info'), title=element('strong',b.title);title.lang='en';info.append(title,element('small',b.subtitle));
      const status=element('span',undefined,'book-status');status.append(element('span',`L${b.level} · ${b.pages.length} 页`),element('span',progress?.stars?'★ 已读完':progress?.visited.length?`续读 · ${progress.page+1} 页`:'开始读 →'));info.append(status);card.append(info);
      if(progress?.favorite)card.append(element('span','♥','book-heart'));
      card.addEventListener('click',()=>openBook(b,Boolean(progress?.finished)));return card;
    }));
    if(!list.length)$('book-grid').append(element('p','这里等着你喜欢的故事。在阅读页轻点「收藏」，就能放进自己的书架。','empty'));
    const start=L.weekStart(today()), summary=L.summary(state,start);
    $('week-count').textContent=`已读 ${summary.readDays} 天`;
    $('calendar').replaceChildren(...Array.from({length:7},(_,i)=>{
      const day=L.shift(start,i), has=state.days[day]?.read.length;
      const tile=element('span','一二三四五六日'[i],`${has?'read ':''}${day===today()?'today':''}`);
      tile.setAttribute('aria-label',`${day}${has?' 已阅读':' 未记录阅读'}${day===today()?' 今天':''}`);tile.append(element('b',has?'✓':Number(day.slice(-2))));return tile;
    }));
    const badges=[];if(lit)badges.push('⛵ 第一本，独立启航');
    for(let n=1;n<=3;n++)if(books.filter(b=>b.level===n).every(b=>state.books[b.id]?.stars))badges.push(`✦ ${names[n-1]}书岛读完啦`);
    if(summary.readDays>=3)badges.push('🌱 本周读了三天');
    $('badges').replaceChildren(...badges.map(t=>element('span',t)));
  }
  function openBook(b,restart=false) {
    current=b;together=false;L.open(state,b,restart);level=b.level;show('reader');renderPage();$('book-title').focus({preventScroll:true});
  }
  function renderPage() {
    stopSpeech();const p=state.books[current.id], page=current.pages[p.page];
    L.visit(state,current,p.page,today(),together);save();
    $('book-level').textContent=`${names[current.level-1]}书岛 · LEVEL ${current.level}`;
    $('book-title').textContent=current.title;$('book-subtitle').textContent=current.subtitle;
    $('page-label').textContent=`第 ${p.page+1} / ${current.pages.length} 页`;
    $('page-dots').replaceChildren(...current.pages.map((_,i)=>element('i',undefined,p.visited.includes(i)?'on':'')));
    $('scene').replaceChildren(...page.scene.map(icon=>element('span',icon)));
    $('sentence').replaceChildren();
    for(const token of page.text.match(/[A-Za-z]+(?:'[A-Za-z]+)?|[^A-Za-z]+/g)||[]) {
      if(!/^[A-Za-z]/.test(token)) {$('sentence').append(document.createTextNode(token));continue;}
      const button=element('button',token,'word');button.setAttribute('aria-label',`${token}，听发音与词义`);
      button.addEventListener('click',()=>{const entry=vocab[token.toLowerCase()];$('word-help').textContent=`${entry?.icon||'🔊'} ${token} · ${entry?.meaning||page.hint}`;say(token,'en-US',button);});
      $('sentence').append(button);
    }
    $('word-help').textContent='🔊 先听一遍，再试着自己读。';$('page-hint').textContent=page.hint;$('page-hint').hidden=true;
    $('show-hint').setAttribute('aria-expanded','false');$('show-hint').textContent='看看这页的意思';
    $('previous').disabled=p.page===0;$('next').textContent=p.page===current.pages.length-1?'合上书 ✦':'下一页 →';
    updateFavorite();updateTogether();
  }
  function updateFavorite() {const fav=state.books[current.id].favorite;$('favorite').textContent=fav?'♥ 已收藏':'♡ 收藏';$('favorite').setAttribute('aria-pressed',String(fav));}
  function updateTogether() {$('invite').setAttribute('aria-pressed',String(together));$('invite').textContent=together?'♧ 家人已入座':'♧ 邀请家人入座';$('together-note').textContent=together?'把身边的位置留给家人，一起听、一起读。再点一次可回到自己读。':'可以自己读，也可以请家人坐在身边。';}
  function finishBook() {
    const wasLit=Boolean(state.books[current.id].stars);
    if(!L.finish(state,current,today())) {notify('还有书页没看过，我们从前面接着读吧。');state.books[current.id].page=current.pages.findIndex((_,i)=>!state.books[current.id].visited.includes(i));if(state.books[current.id].page<0)state.books[current.id].page=0;renderPage();return;}
    save();show('celebration');$('celebrate-title').textContent=together?'我们一起读完啦！':'我读完一本英文书啦！';
    $('celebrate-art').textContent=together?'⛵ ⛵ ✨':'⛵ ✨';
    $('celebrate-message').textContent=wasLit?'熟悉的故事，又读完了一遍。灯塔为你继续闪亮。':'灯塔又亮了一格，谢谢你带来的这一束光。';
    $('celebrate-title').focus({preventScroll:true});
  }
  function home() {show('home');together=false;renderHome();}
  function parentReport() {
    const box=$('parent-content');box.replaceChildren();
    const last=find(state.last), p=last&&state.books[last.id];
    const status=element('div',undefined,'report');status.append(element('h3','当前阅读 · 本机档案'),element('p',last?`${names[last.level-1]} L${last.level} · ${last.subtitle} · ${p.finished?'已读完':`第 ${p.page+1} 页`}`:'还没有开始阅读，选一本喜欢的书就好。'));box.append(status);
    const start=L.weekStart(today());
    for(const [title,week] of [['本周进度',start],['最近周报 · 上一周',L.shift(start,-7)]]) {
      const stats=L.summary(state,week), panel=element('div',undefined,'report');panel.append(element('h3',title),element('p',`${week} — ${L.shift(week,6)}`),element('p',`读完 ${stats.finished} 本（含重读） · 阅读 ${stats.readDays} 天 · 共读 ${stats.togetherDays} 天`));
      panel.append(element('p',`孩子收藏 Top 3：${stats.favorites.map(id=>find(id).subtitle).join('、')||'还没有收藏'}`));box.append(panel);
    }
    box.append(element('p','周报每周按自然周汇总，不推送、不催促。收藏按当前收藏及该周读完次数排序；同一本重读计入读完本数，灯塔只点亮一格。','muted'));
    $('parent').showModal();
  }
  document.querySelectorAll('[data-level]').forEach(b=>b.addEventListener('click',()=>{level=Number(b.dataset.level);favoritesOnly=false;renderHome();}));
  $('favorites').addEventListener('click',()=>{favoritesOnly=!favoritesOnly;renderHome();});
  $('resume').addEventListener('click',()=>openBook(find(state.last)));
  $('leave').addEventListener('click',home);
  $('favorite').addEventListener('click',()=>{state.books[current.id].favorite=!state.books[current.id].favorite;save();updateFavorite();});
  $('previous').addEventListener('click',()=>{if(state.books[current.id].page>0){state.books[current.id].page--;renderPage();}});
  $('next').addEventListener('click',()=>{if(state.books[current.id].page===current.pages.length-1)finishBook();else {state.books[current.id].page++;renderPage();}});
  $('listen').addEventListener('click',()=>{if(window.speechSynthesis?.speaking||window.speechSynthesis?.pending)stopSpeech();else say(current.pages[state.books[current.id].page].text);});
  $('show-hint').addEventListener('click',()=>{const h=$('page-hint');h.hidden=!h.hidden;$('show-hint').setAttribute('aria-expanded',String(!h.hidden));$('show-hint').textContent=h.hidden?'看看这页的意思':'收起中文提示';});
  $('invite').addEventListener('click',()=>{together=!together;L.visit(state,current,state.books[current.id].page,today(),together);save();updateTogether();if(together)say('请邀请家人坐到你身边，一起听，一起读。不需要登录，也不用另一台设备。','zh-CN');});
  $('guide').addEventListener('click',()=>say('欢迎来到小灯塔。选一本喜欢的书，点喇叭听英文，点单词听发音。看完每一页，合上书，就能点亮灯塔。你可以随时停下来，下次接着读。','zh-CN'));
  $('rest').addEventListener('click',home);$('reread').addEventListener('click',()=>openBook(current,true));
  $('next-book').addEventListener('click',()=>{const same=books.filter(b=>b.level===current.level&&!state.books[b.id]?.stars&&b.id!==current.id), next=same[0]||books.find(b=>!state.books[b.id]?.stars)||books[(books.indexOf(current)+1)%books.length];openBook(next,Boolean(state.books[next.id]?.finished));});
  $('parent-open').addEventListener('click',parentReport);
  $('settings-open').addEventListener('click',()=>{stopSpeech();$('settings').showModal();});
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  for(const id of ['rate','font-size','contrast'])$(id).addEventListener('change',()=>{stopSpeech();state.settings={rate:Number($('rate').value),size:Number($('font-size').value),contrast:$('contrast').checked};applySettings();save();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSpeech();});window.addEventListener('pagehide',stopSpeech);
  window.speechSynthesis?.getVoices();applySettings();renderHome();
})();
