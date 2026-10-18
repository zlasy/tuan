/* Local reading records; no speech assessment or network writes. */
(function (root) {
  const empty = () => ({books:{},days:{},last:null,settings:{rate:0.8,size:1,contrast:false}});
  const shift = (day,n) => { const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10); };
  const weekStart = day => shift(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
  function restore(raw, catalog) {
    const s=empty(); let data; try {data=JSON.parse(raw);} catch {return s;}
    if(!data || typeof data!=='object') return s;
    for(const b of catalog) {
      const p=data.books?.[b.id]; if(!p || typeof p!=='object') continue;
      s.books[b.id]={page:Number.isInteger(p.page)&&p.page>=0&&p.page<b.pages.length?p.page:0,
        visited:[...new Set((Array.isArray(p.visited)?p.visited:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<b.pages.length))],
        stars:p.stars===1?1:0,favorite:p.favorite===true,finished:p.finished===true};
    }
    const ids=new Set(catalog.map(b=>b.id));
    for(const [day,value] of Object.entries(data.days||{})) {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!value||typeof value!=='object')continue;
      s.days[day]=Object.fromEntries(['read','together','finished'].map(k=>[k,(Array.isArray(value[k])?value[k]:[]).filter(id=>ids.has(id))]));
    }
    s.last=ids.has(data.last)?data.last:null;
    s.settings={rate:[0.65,0.8,1].includes(data.settings?.rate)?data.settings.rate:0.8,size:[1,1.2,1.4].includes(data.settings?.size)?data.settings.size:1,contrast:data.settings?.contrast===true};
    // Reports are recomputed from validated local records, never trusted HTML.
    return s;
  }
  function open(s,b,restart=false) {
    const old=s.books[b.id]||{stars:0,favorite:false};
    if(restart||!s.books[b.id]) s.books[b.id]={...old,page:0,visited:[],finished:false};
    s.last=b.id;return s.books[b.id];
  }
  function visit(s,b,page,day,together=false) {
    if(!Number.isInteger(page)||page<0||page>=b.pages.length)return;
    const p=open(s,b);p.page=page;if(!p.visited.includes(page))p.visited.push(page);
    const d=s.days[day]??={read:[],together:[],finished:[]};
    if(!d.read.includes(b.id))d.read.push(b.id);
    if(together&&!d.together.includes(b.id))d.together.push(b.id);
  }
  function finish(s,b,day) {
    const p=s.books[b.id];
    if(!p||p.finished||p.visited.length!==b.pages.length)return false;
    p.finished=true;p.stars=1;
    const d=s.days[day]??={read:[],together:[],finished:[]};d.finished.push(b.id);return true;
  }
  function summary(s,start) {
    const days=Array.from({length:7},(_,i)=>s.days[shift(start,i)]);
    const finished=days.flatMap(d=>d?.finished||[]);
    return {readDays:days.filter(d=>d?.read.length).length,togetherDays:days.filter(d=>d?.together.length).length,finished:finished.length,
      favorites:Object.keys(s.books).filter(id=>s.books[id].favorite).sort((a,b)=>finished.filter(id=>id===b).length-finished.filter(id=>id===a).length).slice(0,3)};
  }
  const api={empty,restore,open,visit,finish,weekStart,shift,summary};
  if(typeof module!=='undefined')module.exports=api;else root.Lighthouse=api;
})(globalThis);
