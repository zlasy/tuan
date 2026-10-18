const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {test} = require('node:test');
const {runInNewContext} = require('node:vm');
const script = readFileSync(`${__dirname}/templates/game_words.html`, 'utf8')
  .match(/<script>([\s\S]*?)<\/script>/)[1].replace('{{ deck|tojson }}', 'initialDeck');
const cat = {word: 'cat', cn: '猫', emoji: '🐱', example: 'A cat.', example_cn: '一只猫。', kind: 'word'};
const dog = {...cat, word: 'dog'};
function setup(fetch) {
  const elements = new Map();
  const element = () => ({
    hidden: false, children: [], style: {}, classList: {remove(){}, toggle(){}, contains(){return false;}},
    addEventListener(type, handler){this[type] = handler;}, setAttribute(){},
    append(child){this.children.push(child);}, replaceChildren(){this.children = [];},
    close(){}, showModal(){}, querySelector(){return element();}
  });
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  runInNewContext(script, {
    document: {querySelector: get, querySelectorAll: () => [], createElement: element},
    crypto: require('node:crypto').webcrypto, fetch, initialDeck: {category: 'all', count: 2, cards: [cat, dog]},
  });
  return get;
}
test('保存失败停留当前卡片，成功重试后推进；认识不会删除错题', async () => {
  const requests = [];
  let ok = false;
  const get = setup(async (url, options) => {
    requests.push({url, ...options}); return {ok, json: async () => ({ok: true})};
  });
  await get('#again').click();
  assert.equal(get('#card-word').textContent, 'cat');
  assert.equal(get('#deck-error').hidden, false);
  ok = true;
  await get('#again').click();
  assert.equal(get('#card-word').textContent, 'dog');
  assert.equal(JSON.parse(requests[1].body).word, 'cat');
  await get('#know').click();
  assert.equal(requests.length, 3);
  assert.equal(requests[2].url, '/api/games/words/answer');
  assert.equal(JSON.parse(requests[2].body).correct, true);
});
test('保存进行中重复点击不会重复计数', async () => {
  let resolve, calls = 0;
  const get = setup(() => {calls++; return new Promise(done => resolve = done);});
  const pending = get('#again').click();
  await get('#again').click();
  await get('#know').click();
  assert.equal(calls, 1);
  assert.equal(get('#card-word').textContent, 'cat');
  resolve({ok: true, json: async () => ({ok: true})});
  await pending;
  assert.equal(get('#card-word').textContent, 'dog');
});
test('错题本显示记录、仅复习错题，并支持移出后的空状态', async () => {
  let cards = [{...cat, mistakes: 2, last_wrong: '2026-10-18T12:00:00+08:00'}];
  const get = setup(async (url, options) => {
    if (options.method === 'DELETE') cards = [];
    return {ok: true, json: async () => ({cards})};
  });
  await get('#open-mistakes').click();
  assert.equal(get('#mistake-book').hidden, false);
  assert.equal(get('#mistake-list').children.length, 1);
  await get('#review-mistakes').click();
  assert.equal(get('#mistake-book').hidden, true);
  assert.equal(get('#card-word').textContent, 'cat');
  await get('#know').click();
  assert.equal(get('#scene').hidden, true);
  await get('#open-mistakes').click();
  await get('#mistake-list').children[0].children.at(-1).click();
  assert.equal(get('#mistake-empty').hidden, false);
  await get('#review-mistakes').click();
  assert.equal(get('#mistake-book').hidden, false);
});
test('答错后再答对沿用同一轮次，复习错题时开始新轮次', async () => {
  const answers = [];
  const get = setup(async (url, options) => {
    if (url.endsWith('/answer')) answers.push(JSON.parse(options.body));
    return {ok: true, json: async () => ({cards: [cat]})};
  });
  await get('#again').click();
  await get('#know').click();
  await get('#know').click();
  assert.deepEqual(answers.map(a => [a.word, a.correct, a.attempt]), [
    ['cat', false, 1], ['dog', true, 1], ['cat', true, 2]
  ]);
  assert.equal(new Set(answers.map(a => a.round_id)).size, 1);
  await get('#review-mistakes').click();
  await get('#know').click();
  assert.notEqual(answers[3].round_id, answers[0].round_id);
  assert.equal(answers[3].attempt, 1);
});
test('保存正确答案失败不推进，重试使用同一提交编号', async () => {
  const answers = [];
  let ok = false;
  const get = setup(async (url, options) => {
    answers.push(JSON.parse(options.body));
    return {ok, json: async () => ({})};
  });
  await get('#know').click();
  assert.equal(get('#card-word').textContent, 'cat');
  ok = true;
  await get('#know').click();
  assert.deepEqual(answers[0], answers[1]);
  assert.equal(get('#card-word').textContent, 'dog');
});
