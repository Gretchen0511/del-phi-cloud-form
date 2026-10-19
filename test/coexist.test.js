const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { newDb } = require('pg-mem');
const { schema } = require('../lib');
const { createServer } = require('../server');
function secondRound() {
  return { version: schema.version, submission_id: crypto.randomUUID(), answers: Object.fromEntries(schema.fields.map(f => [f.id, f.type === 'score' ? 4 : f.type === 'choice' ? f.options[0] : f.type === 'multi' ? [f.options[0]] : f.type === 'date' ? '2026-10-19' : f.required ? 'R2-TEST' : ''])) };
}
test('两轮数据与旧地址兼容：旧记录不变，分别提交、读取和导出', async () => {
  // pg-mem skips planning constraints on an existing CREATE TABLE IF NOT EXISTS.
  const db = newDb({ noAstCoverageCheck: true }); const { Pool } = db.adapters.createPg(); const pool = new Pool();
  await pool.query(fs.readFileSync('db/round1.sql', 'utf8'));
  const old = { name: '第一轮原记录', institution: '测试单位', mechanism_scores: [{ item: '规则清晰', score: 5, suggestion: '保留' }], emotion_scores: [{ word: '平静', clarity: 4 }] };
  await pool.query('INSERT INTO delphi_responses (expert_name,expert_org,payload) VALUES ($1,$2,$3)', [old.name, old.institution, JSON.stringify(old)]);
  const before = await pool.query('SELECT * FROM delphi_responses');
  await pool.query(fs.readFileSync('db/schema.sql', 'utf8')); // Existing table must remain intact.
  const after = await pool.query('SELECT * FROM delphi_responses');
  assert.deepEqual(after.rows, before.rows);
  const server = createServer(pool, 'coexist-test');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const headers = { Authorization: 'Bearer coexist-test' };
  const post = (route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    for (const route of ['/', '/round1', '/index.html']) {
      const response = await fetch(base + route); assert.equal(response.status, 200);
      assert((await response.text()).includes('第一轮专家咨询'));
      assert(response.headers.get('content-security-policy').includes("'unsafe-inline'"));
    }
    for (const route of ['/admin', '/admin/round1', '/admin.html']) assert((await (await fetch(base + route)).text()).includes('第一轮专家咨询表提交数据'));
    for (const route of ['/round2', '/admin/round2']) {
      const r = await fetch(base + route); assert.equal(r.status, 200); assert(!r.headers.get('content-security-policy').includes('unsafe-inline')); assert((await r.text()).includes('第二轮'));
    }
    assert.equal((await fetch(base + '/round2/app.js')).status, 200);
    assert.equal((await fetch(base + '/rounds')).status, 200);
    assert.equal((await fetch(base + '/api/responses')).status, 401);
    assert.equal((await fetch(base + '/api/responses.csv')).status, 401);
    let first = await (await fetch(base + '/api/responses?token=coexist-test')).json();
    assert.equal(first.count, 1); assert.deepEqual(first.rows[0].payload, old);
    const second = secondRound(); assert.equal((await post('/api/round2/responses', second)).status, 200);
    for (const route of ['/api/submit', '/api/responses']) {
      const r = await post(route, { ...old, name: '第一轮新记录' }); const data = await r.json(); assert.equal(r.status, 200); assert.equal(data.ok, true); assert.equal(data.success, true);
    }
    first = await (await fetch(base + '/api/responses', { headers })).json();
    const round2 = await (await fetch(base + '/api/round2/admin/responses', { headers })).json();
    assert.equal(first.count, 3); assert.equal(round2.length, 1);
    assert(first.rows.some(r => JSON.stringify(r.payload) === JSON.stringify(old)));
    const csv1 = await (await fetch(base + '/api/responses.csv?token=coexist-test')).text();
    const csv2 = await (await fetch(base + '/api/round2/admin/export.csv', { headers })).text();
    assert(csv1.includes('mechanism_scores_规则清晰_score')); assert(csv1.includes('emotion_scores_平静_clarity')); assert(!csv1.includes('[object Object]')); assert(!csv1.includes('R2-TEST'));
    assert(csv2.includes('R2-TEST')); assert(!csv2.includes('第一轮原记录')); assert(csv2.includes('play_15'));
    assert.equal((await fetch(base + '/api/round2/admin/responses?token=coexist-test')).status, 401);
    assert.equal((await post('/api/submit', null)).status, 400);
    assert.equal((await post('/api/round2/responses', null)).status, 400);
    assert.equal((await fetch(base + '/db/schema.sql')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); await pool.end(); }
});
