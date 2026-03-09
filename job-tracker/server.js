import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { stringify } from 'csv-stringify';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// Build a connection pool from env
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.PGSSLMODE ? { rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0' } : false,
});

const TABLE = `public."Jobs_List"`;

async function ensureSchema() {
  const client = await pool.connect();
  try {
    // Add optional columns if missing
    await client.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS applied boolean DEFAULT false`);
    await client.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS applied_at timestamptz`);
    await client.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS notes text DEFAULT ''`);
    await client.query(`UPDATE ${TABLE} SET applied = false WHERE applied IS NULL`);
    await client.query(`ALTER TABLE ${TABLE} ALTER COLUMN applied SET NOT NULL`);
  } finally {
    client.release();
  }
}

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT 1 as ok');
    res.json({ ok: true, db: r.rows[0].ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// List jobs
app.get('/api/jobs', async (req, res) => {
  const search = (req.query.search || '').toString().trim();
  const onlyUnapplied = req.query.onlyUnapplied === 'true';

  const params = [];
  const conditions = [];
  if (search) {
    params.push(`%${search}%`);
    conditions.push('(company_name ILIKE $' + params.length + ' OR job_link ILIKE $' + params.length + ')');
  }
  if (onlyUnapplied) {
    conditions.push('applied = false');
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const sql = `SELECT id, company_name, job_link, applied, applied_at, notes
               FROM ${TABLE}
               ${where}
               ORDER BY id DESC`;
  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Toggle applied
app.patch('/api/jobs/:id/apply', async (req, res) => {
  const id = Number(req.params.id);
  const applied = Boolean(req.body?.applied);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const { rows } = await pool.query(
      `UPDATE ${TABLE}
       SET applied = $1,
           applied_at = CASE WHEN $1 THEN NOW() ELSE NULL END
       WHERE id = $2
       RETURNING id, company_name, job_link, applied, applied_at, notes`,
      [applied, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update notes
app.patch('/api/jobs/:id/notes', async (req, res) => {
  const id = Number(req.params.id);
  const notes = (req.body?.notes ?? '').toString();
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const { rows } = await pool.query(
      `UPDATE ${TABLE}
       SET notes = $1
       WHERE id = $2
       RETURNING id, company_name, job_link, applied, applied_at, notes`,
      [notes, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Bulk apply
app.post('/api/jobs/bulk/apply', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
  const applied = Boolean(req.body?.applied);
  if (ids.length === 0) return res.status(400).json({ error: 'No valid ids' });
  try {
    const { rowCount } = await pool.query(
      `UPDATE ${TABLE}
       SET applied = $1,
           applied_at = CASE WHEN $1 THEN NOW() ELSE NULL END
       WHERE id = ANY($2::int[])`,
      [applied, ids]
    );
    res.json({ updated: rowCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// CSV export of current filter
app.get('/api/export', async (req, res) => {
  const search = (req.query.search || '').toString().trim();
  const onlyUnapplied = req.query.onlyUnapplied === 'true';
  const params = [];
  const conditions = [];
  if (search) {
    params.push(`%${search}%`);
    conditions.push('(company_name ILIKE $' + params.length + ' OR job_link ILIKE $' + params.length + ')');
  }
  if (onlyUnapplied) conditions.push('applied = false');
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const sql = `SELECT id, company_name, job_link, applied, applied_at, notes FROM ${TABLE} ${where} ORDER BY id DESC`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="jobs_export.csv"');
  try {
    const { rows } = await pool.query(sql, params);
    const stringifier = stringify({ header: true, columns: ['id','company_name','job_link','applied','applied_at','notes'] });
    rows.forEach(r => stringifier.write(r));
    stringifier.pipe(res);
    stringifier.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve static UI
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

(async function start() {
  try {
    await ensureSchema();
    app.listen(PORT, () => console.log(`Job Tracker running on http://localhost:${PORT}`));
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }
})();
