const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./static/lighthouse-core.js');
const books = require('./lighthouse_books.json');
const book = books[0];
test('39 unique readers, 13 per level, increasing sentence length', () => {
  assert.equal(books.length,39); assert.equal(new Set(books.map(b=>b.id)).size,39);
  let previous=0;
  for (const level of [1,2,3]) {
    const subset=books.filter(b=>b.level===level); assert.equal(subset.length,13);
    const words=subset.flatMap(b=>b.pages).map(p=>{assert.ok(p.hint && p.icon);return p.text.split(' ').length});
    const mean=words.reduce((a,b)=>a+b)/words.length; assert.ok(mean>previous); previous=mean;
  }
});
test('partial reading cannot light tower; complete once; reread never removes star',()=>{
  const s=L.empty(); L.open(s,book); L.visit(s,book,0,'2026-10-18');
  assert.equal(L.finish(s,book,'2026-10-18'),false);
  for(let i=1;i<book.pages.length;i++) L.visit(s,book,i,'2026-10-18');
  assert.equal(L.finish(s,book,'2026-10-18'),true);
  assert.equal(s.books[book.id].stars,1); assert.equal(L.finish(s,book,'2026-10-18'),false);
  L.open(s,book,true); assert.equal(s.books[book.id].stars,1);
  assert.equal(L.finish(s,book,'2026-10-19'),false);
  assert.equal(s.days['2026-10-18'].finished.length,1);
});
test('resume retains page and visited pages; together is optional',()=>{
  const s=L.empty(); L.open(s,book); L.visit(s,book,2,'2026-10-18',true);
  const loaded=L.restore(JSON.stringify(s),books); L.open(loaded,book);
  assert.equal(loaded.books[book.id].page,2);
  assert.deepEqual(loaded.books[book.id].visited,[2]);
  assert.deepEqual(loaded.days['2026-10-18'].together,[book.id]);
});
test('corrupted storage recovers safely',()=>{
  for(const raw of ['bad','null','[]','{"books":null}','{"books":{"l1-01":{"page":999,"visited":[-1,99],"stars":7}}}']) {
    const s=L.restore(raw,books); L.open(s,book);
    assert.ok(s.books[book.id].page<book.pages.length);
    assert.ok(s.books[book.id].visited.every(p=>p>=0&&p<book.pages.length));
    assert.ok(s.books[book.id].stars<=1);
  }
});
test('weeks use Monday boundaries including year change',()=>{
  assert.equal(L.weekStart('2026-10-18'),'2026-10-12');
  assert.equal(L.weekStart('2026-10-19'),'2026-10-19');
  assert.equal(L.weekStart('2027-01-01'),'2026-12-28');
  const s=L.empty(); L.open(s,book); L.visit(s,book,0,'2026-10-18');
  assert.equal(L.summary(s,'2026-10-12').readDays,1);
  assert.equal(L.summary(s,'2026-10-19').readDays,0);
});

const fs=require('node:fs'), vm=require('node:vm');
function mount({blocked=false,raw=null}={}) {
  class Element {
    constructor(){this.children=[];this.events={};this.dataset={};this.style={setProperty(){}};this.classList={toggle(){},remove(){},add(){}};this.textContent='';this.hidden=false;}
    append(...children){this.children.push(...children)}
    replaceChildren(...children){this.children=children}
    setAttribute(){} addEventListener(name,fn){this.events[name]=fn} focus(){} showModal(){} close(){}
  }
  const nodes=new Map(), $=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};
  $('book-data').textContent=JSON.stringify(books);
  $('vocab-data').textContent=fs.readFileSync(require.resolve('./lighthouse_vocab.json'),'utf8');
  const doc={getElementById:$,createElement:()=>new Element(),createTextNode:text=>text,querySelectorAll:()=>[],addEventListener(){},body:new Element(),documentElement:new Element()};
  const localStorage={getItem(){if(blocked)throw Error('blocked');return raw},setItem(k,v){if(blocked)throw Error('full');raw=v}};
  const context={document:doc,localStorage,Intl,Date,JSON,setTimeout,clearTimeout,window:{Lighthouse:L,scrollTo(){},addEventListener(){}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('./static/lighthouse.js'),'utf8'),context);
  const click=id=>$(id).events.click();
  $('book-grid').children[0].events.click();
  return {$,click,getRaw:()=>raw};
}
test('without browser speech, listening and word help degrade without crashing',()=>{
  const ui=mount();ui.click('listen');assert.match(ui.$('notice').textContent,/暂不支持朗读/);
  const word=ui.$('sentence').children.find(c=>c.events?.click);word.events.click();
  assert.match(ui.$('word-help').textContent,/I/);
});
test('blocked storage keeps complete reading loop usable and warns about persistence',()=>{
  const ui=mount({blocked:true});for(let i=0;i<6;i++)ui.click('next');
  assert.equal(ui.$('celebration').hidden,false);assert.match(ui.$('notice').textContent,/无法保存/);
});
test('UI finish, restart, favorite and resume persist correct independent state',()=>{
  const ui=mount();ui.click('favorite');ui.click('next');ui.click('leave');
  let s=JSON.parse(ui.getRaw());assert.equal(s.books[book.id].page,1);assert.equal(s.books[book.id].favorite,true);
  ui.click('resume');for(let i=0;i<5;i++)ui.click('next');
  s=JSON.parse(ui.getRaw());assert.equal(s.books[book.id].stars,1);
  ui.click('reread');ui.click('leave');s=JSON.parse(ui.getRaw());
  assert.equal(s.books[book.id].stars,1);assert.equal(s.books[book.id].finished,false);assert.equal(s.books[book.id].page,0);
});
