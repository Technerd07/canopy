import crypto from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import pg from 'pg';

const app = express();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const COOKIE_NAME = 'canopy_sid';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const SESSION_DAYS = 30;

app.use(express.json());
app.use(cookieParser());

async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id            SERIAL PRIMARY KEY,
      username      VARCHAR(40) UNIQUE NOT NULL,
      display_name  VARCHAR(80) NOT NULL,
      title         VARCHAR(60) NOT NULL DEFAULT 'Admin',
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash    CHAR(64) PRIMARY KEY,
      admin_id      INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      expires_at    TIMESTAMPTZ NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON admin_sessions(expires_at);
  `);
}

function verifyPassword(password, storedHash) {
  const [salt, keyHex] = String(storedHash || '').split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(keyHex, 'hex');
  return derived.length === stored.length && crypto.timingSafeEqual(derived, stored);
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// Public admin list (no hashes) for badges & reserved-name checks
app.get('/api/auth/admins', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT username AS id, display_name AS name, title FROM admins ORDER BY id ASC'
    );
    res.json({ admins: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Verify active session cookie
app.get('/api/auth/me', async (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.json({ user: null });

  try {
    const { rows } = await pool.query(
      `SELECT a.username AS id, a.display_name AS name, a.title
       FROM admin_sessions s
       JOIN admins a ON a.id = s.admin_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [sha256(token)]
    );
    if (!rows.length) return res.json({ user: null });
    res.json({ user: { ...rows[0], role: 'admin' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin login
app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const passphrase = String(req.body?.passphrase || '');
  if (!username || !passphrase) {
    return res.status(400).json({ error: 'Username and passphrase required' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, username, display_name, title, password_hash FROM admins WHERE username = $1',
      [username]
    );
    const admin = rows[0];
    if (!admin || !verifyPassword(passphrase, admin.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);

    await pool.query(
      'INSERT INTO admin_sessions (token_hash, admin_id, expires_at) VALUES ($1, $2, $3)',
      [sha256(token), admin.id, expiresAt]
    );

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: COOKIE_SECURE,
      expires: expiresAt,
      path: '/'
    });

    res.json({
      user: { id: admin.username, name: admin.display_name, title: admin.title, role: 'admin' }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin logout
app.post('/api/auth/logout', async (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (token) {
    await pool.query('DELETE FROM admin_sessions WHERE token_hash = $1', [sha256(token)]).catch(() => {});
  }
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

initTables()
  .then(() => app.listen(3000, () => console.log('Canopy API listening on :3000')))
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });