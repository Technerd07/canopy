import crypto from 'node:crypto';
import { pool } from '../db.js';

export const SESSION_COOKIE = 'canopy_sid';
export const VISITOR_COOKIE = 'canopy_vid';
export const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

export const sha256 = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex');

export async function attachAuth(req, res, next) {
  try {
    req.admin = null;
    const rawSid = req.cookies?.[SESSION_COOKIE];
    if (rawSid && typeof rawSid === 'string') {
      const { rows } = await pool.query(
        `SELECT a.id, a.username, a.display_name, a.title
         FROM admin_sessions s
         JOIN admins a ON a.id = s.admin_id
         WHERE s.token_hash = $1 AND s.expires_at > NOW()
         LIMIT 1`,
        [sha256(rawSid)]
      );
      if (rows[0]) {
        req.admin = {
          id: rows[0].id,
          username: rows[0].username,
          name: rows[0].display_name,
          title: rows[0].title,
          role: 'admin'
        };
      }
    }

    let vid = req.cookies?.[VISITOR_COOKIE];
    if (!vid || typeof vid !== 'string' || vid.length < 16) {
      vid = crypto.randomBytes(16).toString('hex');
      res.cookie(VISITOR_COOKIE, vid, {
        httpOnly: true,
        sameSite: 'lax',
        secure: COOKIE_SECURE,
        path: '/',
        maxAge: 365 * 24 * 60 * 60 * 1000
      });
    }
    req.voterHash = sha256(vid);

    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ error: 'Administrator session required' });
  }
  next();
}

export async function isReservedName(name) {
  const norm = String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!norm) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM admins WHERE LOWER(username) = $1 OR LOWER(display_name) = $1 LIMIT 1`,
    [norm]
  );
  return rows.length > 0;
}