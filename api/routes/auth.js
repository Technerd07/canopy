import crypto from 'node:crypto';
import express from 'express';
import { pool } from '../db.js';
import { SESSION_COOKIE, COOKIE_SECURE, sha256 } from '../middleware/auth.js';

const router = express.Router();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function verifyPassword(password, stored) {
  const [salt, keyHex] = String(stored || '').split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  return derived.length === keyBuf.length && crypto.timingSafeEqual(derived, keyBuf);
}

router.get('/admins', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT username AS id, display_name AS name, title FROM admins ORDER BY id ASC`
    );
    res.json({ admins: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/me', (req, res) => {
  res.json({ user: req.admin || null });
});

router.post('/login', async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const passphrase = String(req.body?.passphrase || '');
    if (!username || !passphrase) {
      return res.status(400).json({ error: 'Username and passphrase are required' });
    }

    const { rows } = await pool.query(
      `SELECT id, username, display_name, title, password_hash FROM admins WHERE LOWER(username) = $1 LIMIT 1`,
      [username]
    );
    const admin = rows[0];
    if (!admin || !verifyPassword(passphrase, admin.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or passphrase' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await pool.query(`DELETE FROM admin_sessions WHERE expires_at <= NOW()`);
    await pool.query(
      `INSERT INTO admin_sessions (admin_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [admin.id, sha256(rawToken), expiresAt]
    );

    res.cookie(SESSION_COOKIE, rawToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: COOKIE_SECURE,
      path: '/',
      maxAge: SESSION_TTL_MS
    });

    res.json({
      user: {
        id: admin.id,
        username: admin.username,
        name: admin.display_name,
        title: admin.title,
        role: 'admin'
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const rawSid = req.cookies?.[SESSION_COOKIE];
    if (rawSid) {
      await pool.query(`DELETE FROM admin_sessions WHERE token_hash = $1`, [sha256(rawSid)]);
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;