import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 10000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function safeColumnName(text) {
  return String(text || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\.\[\]]+/g, '_')
    .replace(/\s+/g, '')
    .slice(0, 80);
}

function flatten(obj, prefix = '', out = {}) {
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const label = safeColumnName(item?.item || item?.dimension || item?.word || `第${index + 1}项`);
      const base = prefix ? `${prefix}_${label}` : label;
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        for (const [k, v] of Object.entries(item)) {
          if (['item', 'dimension', 'word', 'category'].includes(k)) continue;
          const col = safeColumnName(`${base}_${k}`);
          if (v && typeof v === 'object') flatten(v, col, out);
          else out[col] = v ?? '';
        }
        if (item.category) out[safeColumnName(`${base}_类别`)] = item.category;
      } else {
        out[safeColumnName(`${base}_${index + 1}`)] = item ?? '';
      }
    });
    return out;
  }

  for (const [key, value] of Object.entries(obj || {})) {
    const next = prefix ? `${prefix}_${key}` : key;
    if (Array.isArray(value)) flatten(value, next, out);
    else if (value && typeof value === 'object') flatten(value, next, out);
    else out[safeColumnName(next)] = value ?? '';
  }
  return out;
}

function toCsv(rows) {
  const flatRows = rows.map(r => ({
    id: r.id,
    created_at: r.created_at,
    expert_name: r.expert_name || '',
    expert_org: r.expert_org || '',
    ...flatten(r.payload)
  }));
  const preferred = ['id','created_at','expert_name','expert_org','name','gender','age','highest_degree','title','institution','professional_background','work_years','final_decision','final_reason'];
  const allHeaders = [...new Set(flatRows.flatMap(r => Object.keys(r)))];
  const headers = [...preferred.filter(h => allHeaders.includes(h)), ...allHeaders.filter(h => !preferred.includes(h))];
  const esc = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return [headers.map(esc).join(','), ...flatRows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}


async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS delphi_responses (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expert_name TEXT,
      expert_org TEXT,
      payload JSONB NOT NULL
    );
  `);
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.post('/api/responses', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ ok: false, error: '提交内容为空或格式不正确' });
    }
    const expertName = payload?.basicInfo?.name || payload?.name || null;
    const expertOrg = payload?.basicInfo?.organization || payload?.institution || null;
    const result = await pool.query(
      'INSERT INTO delphi_responses (expert_name, expert_org, payload) VALUES ($1, $2, $3) RETURNING id, created_at',
      [expertName, expertOrg, payload]
    );
    res.json({ ok: true, id: result.rows[0].id, createdAt: result.rows[0].created_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: '服务器保存失败，请稍后再试或联系研究团队。' });
  }
});


app.post('/api/submit', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, message: '提交内容为空或格式不正确' });
    }
    const expertName = payload?.basicInfo?.name || payload?.name || null;
    const expertOrg = payload?.basicInfo?.organization || payload?.institution || null;
    const result = await pool.query(
      'INSERT INTO delphi_responses (expert_name, expert_org, payload) VALUES ($1, $2, $3) RETURNING id, created_at',
      [expertName, expertOrg, payload]
    );
    res.json({ success: true, ok: true, id: result.rows[0].id, createdAt: result.rows[0].created_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, ok: false, message: '服务器保存失败，请稍后再试或联系研究团队。' });
  }
});

app.get('/api/responses', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: '未授权' });
  }
  const result = await pool.query('SELECT id, created_at, expert_name, expert_org, payload FROM delphi_responses ORDER BY created_at DESC');
  res.json({ ok: true, count: result.rowCount, rows: result.rows });
});


app.get('/api/responses.csv', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).send('未授权');
  }
  const result = await pool.query('SELECT id, created_at, expert_name, expert_org, payload FROM delphi_responses ORDER BY created_at DESC');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="delphi_responses.csv"');
  res.send('\ufeff' + toCsv(result.rows));
});

await ensureTable();
app.listen(port, () => console.log(`Delphi form running on port ${port}`));
