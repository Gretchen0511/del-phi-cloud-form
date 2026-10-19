const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { Pool } = require('pg');
const { schema, validate, clean, csv } = require('./lib');
const { toCsv } = require('./legacy');

function createServer(pool, token) {
  const attempts = new Map();
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    function send(status, data, type = 'application/json; charset=utf-8', legacyPage = false) {
      res.writeHead(status, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        // The retained first-round pages contain their original inline CSS and scripts.
        'Content-Security-Policy': `default-src 'self'; script-src 'self'${legacyPage ? " 'unsafe-inline'" : ''}; style-src 'self'${legacyPage ? " 'unsafe-inline'" : ''}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
      });
      res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
    }
    function authorized(legacy = false) {
      const ip = req.socket.remoteAddress;
      let bucket = attempts.get(ip);
      if (!bucket || Date.now() - bucket.at > 60000) {
        bucket = { n: 0, at: Date.now() };
        attempts.set(ip, bucket);
      }
      if (attempts.size > 10000) attempts.clear();
      if (bucket.n >= 20) { send(429, { ok: false, error: '尝试过多，请一分钟后重试' }); return false; }
      const credential = req.headers.authorization || (legacy && url.searchParams.has('token') ? 'Bearer ' + url.searchParams.get('token') : '');
      const actual = Buffer.from(credential);
      const expected = Buffer.from('Bearer ' + token);
      if (!token || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        bucket.n++;
        send(401, { ok: false, error: '管理员密码错误' });
        return false;
      }
      return true;
    }
    async function readBody(limit) {
      if (!req.headers['content-type']?.startsWith('application/json')) {
        send(415, { ok: false, error: '请提交JSON' }); return undefined;
      }
      let raw = '', size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > limit) { send(413, { ok: false, error: '提交内容过大' }); return undefined; }
        raw += chunk;
      }
      try { return JSON.parse(raw); }
      catch { send(400, { ok: false, error: '提交内容格式错误' }); return undefined; }
    }
    try {
      if (req.method === 'GET' && ['/health', '/healthz'].includes(url.pathname)) {
        await pool.query('SELECT 1');
        return send(200, { ok: true });
      }

      if (req.method === 'GET' && ['/api/responses', '/api/responses.csv'].includes(url.pathname)) {
        if (!authorized(true)) return;
        const result = await pool.query('SELECT id, created_at, expert_name, expert_org, payload FROM delphi_responses ORDER BY created_at DESC');
        if (url.pathname.endsWith('.csv')) {
          res.setHeader('Content-Disposition', 'attachment; filename="delphi_responses.csv"');
          return send(200, '\uFEFF' + toCsv(result.rows), 'text/csv; charset=utf-8');
        }
        return send(200, { ok: true, count: result.rows.length, rows: result.rows });
      }

      if (url.pathname.startsWith('/api/round2/admin/')) {
        if (!authorized()) return;
        if (req.method !== 'GET') return send(405, { error: '不支持的方法' });
        if (!['/api/round2/admin/responses', '/api/round2/admin/export.csv'].includes(url.pathname)) return send(404, { error: '接口不存在' });
        const { rows } = await pool.query('SELECT id, created_at, expert_id, payload FROM delphi_round2_responses ORDER BY created_at DESC');
        if (url.pathname.endsWith('/export.csv')) {
          res.setHeader('Content-Disposition', 'attachment; filename="delphi-round2.csv"');
          return send(200, csv(rows), 'text/csv; charset=utf-8');
        }
        return send(200, rows);
      }

      if (req.method === 'POST' && ['/api/responses', '/api/submit', '/api/round2/responses'].includes(url.pathname)) {
        const forwardedProto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
        if (req.headers.origin && req.headers.origin !== `${forwardedProto}://${req.headers.host}`) {
          return send(403, { error: '来源不匹配' });
        }
        const round2 = url.pathname === '/api/round2/responses';
        const body = await readBody(round2 ? 256000 : 1024 * 1024);
        if (body === undefined) return;
        if (round2) {
          const error = validate(body);
          if (error) return send(400, { error });
          const payload = clean(body);
          await pool.query('INSERT INTO delphi_round2_responses (id,expert_id,questionnaire_version,payload) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING RETURNING id', [body.submission_id, payload.answers.expert_id, schema.version, JSON.stringify(payload)]);
          const prior = await pool.query('SELECT payload FROM delphi_round2_responses WHERE id=$1', [body.submission_id]);
          if (!isDeepStrictEqual(prior.rows[0]?.payload, payload)) return send(409, { error: '提交编号已使用，请重新打开问卷填写' });
          return send(200, { ok: true, id: body.submission_id });
        }
        // Preserve the payload structure and response formats used by both first-round clients.
        if (!body || typeof body !== 'object' || Array.isArray(body)) return send(400, { success: false, ok: false, error: '提交内容为空或格式不正确' });
        const expertName = body.basicInfo?.name || body.name || null;
        const expertOrg = body.basicInfo?.organization || body.institution || null;
        const result = await pool.query('INSERT INTO delphi_responses (expert_name, expert_org, payload) VALUES ($1, $2, $3) RETURNING id, created_at', [expertName, expertOrg, JSON.stringify(body)]);
        return send(200, { success: true, ok: true, id: result.rows[0].id, createdAt: result.rows[0].created_at });
      }

      if (req.method === 'GET') {
        const files = {
          '/': 'index.html', '/index.html': 'index.html', '/round1': 'index.html', '/round1/': 'index.html',
          '/admin': 'admin.html', '/admin/': 'admin.html', '/admin.html': 'admin.html', '/admin/round1': 'admin.html',
          '/app.js': 'app.js', '/style.css': 'style.css', '/rounds': 'rounds.html',
          '/round2': 'round2/index.html', '/round2/': 'round2/index.html', '/round2/index.html': 'round2/index.html',
          '/admin/round2': 'round2/admin.html', '/admin/round2/': 'round2/admin.html',
          '/round2/schema.json': 'round2/schema.json', '/round2/app.js': 'round2/app.js',
          '/round2/admin.js': 'round2/admin.js', '/round2/style.css': 'round2/style.css',
        };
        const file = files[url.pathname];
        if (file) {
          const buffer = fs.readFileSync(path.join(__dirname, 'public', file));
          const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/javascript; charset=utf-8';
          return send(200, file.endsWith('.json') ? JSON.parse(buffer) : buffer, type, ['index.html', 'admin.html'].includes(file));
        }
      }
      send(404, { error: '页面不存在' });
    } catch (error) {
      console.error('Request failed:', error.code || error.name);
      send(503, { success: false, ok: false, error: '服务暂时无法完成操作，请稍后重试；填写内容仍保留在当前页面', message: '服务器保存失败，请稍后重试' });
    }
  });
}

async function start() {
  if (!process.env.DATABASE_URL || !process.env.ADMIN_TOKEN) throw Error('请配置 DATABASE_URL 和 ADMIN_TOKEN');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 15000, query_timeout: 20000 });
  pool.on('error', error => console.error('Database connection error', error.code));
  await pool.query(fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8'));
  const server = createServer(pool, process.env.ADMIN_TOKEN);
  server.listen(Number(process.env.PORT) || 10000, '0.0.0.0', () => console.log('Delphi rounds 1 and 2 ready'));
  process.on('SIGTERM', () => server.close(() => pool.end().then(() => process.exit(0))));
}
if (require.main === module) start().catch(error => { console.error('Startup failed:', error.code || error.message); process.exit(1); });
module.exports = { createServer };
