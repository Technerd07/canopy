import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { pool } from '../db.js';
import { requireAdmin, isReservedName } from '../middleware/auth.js';
import { UPLOAD_DIR } from './uploads.js';

const router = express.Router();

const ALLOWED_CATEGORIES = new Set([
  'General', 'Moments', 'Snapshots', 'Technology',
  'News & Politics', 'Journal & Mindfulness', 'Random'
]);
const ALLOWED_TONES = new Set([
  'sage', 'sky', 'lavender', 'amber', 'rose',
  'teal', 'coral', 'indigo', 'olive', 'slate'
]);

function isSafeUrl(u, allowRelativeUpload = false) {
  if (!u) return true;
  if (allowRelativeUpload && u.startsWith('/uploads/')) return true;
  return /^https?:\/\//i.test(u);
}

function sanitizeMedia(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 10)
    .filter((m) => m && (m.type === 'image' || m.type === 'video') && typeof m.url === 'string' && isSafeUrl(m.url.trim(), true))
    .map((m, idx) => ({ type: m.type, url: m.url.trim(), position: idx }));
}

async function unlinkLocalUploads(urls) {
  for (const u of urls) {
    if (typeof u === 'string' && u.startsWith('/uploads/')) {
      const safeName = path.basename(u);
      await fs.unlink(path.join(UPLOAD_DIR, safeName)).catch(() => {});
    }
  }
}

function formatPostRow(row, media = [], comments = []) {
  return {
    id: Number(row.id),
    title: row.title,
    summary: row.summary,
    body: row.body,
    url: row.url,
    category: row.category,
    domain: row.domain,
    tone: row.tone,
    author: row.author,
    authorRole: row.author_role,
    upvotes: row.upvotes,
    views: row.views,
    media,
    comments,
    createdAt: row.created_at,
    editedAt: row.edited_at
  };
}

function buildCommentTree(rows) {
  const byId = new Map();
  const roots = [];
  for (const r of rows) {
    byId.set(Number(r.id), {
      id: Number(r.id),
      author: r.author,
      authorRole: r.author_role,
      text: r.text,
      upvotes: r.upvotes,
      createdAt: r.created_at,
      replies: []
    });
  }
  for (const r of rows) {
    const node = byId.get(Number(r.id));
    if (r.parent_id && byId.has(Number(r.parent_id))) {
      byId.get(Number(r.parent_id)).replies.push(node);
    } else {
      roots.unshift(node); // newest top-level comments first, replies chronological
    }
  }
  return roots;
}

// GET /api/posts
router.get('/', async (req, res, next) => {
  try {
    const [postsRes, mediaRes, commentsRes, postVotesRes, commentVotesRes] = await Promise.all([
      pool.query(`SELECT * FROM posts ORDER BY created_at DESC LIMIT 200`),
      pool.query(`SELECT post_id, type, url FROM post_media ORDER BY post_id, position ASC, id ASC`),
      pool.query(`SELECT * FROM comments ORDER BY created_at ASC`),
      pool.query(`SELECT post_id FROM post_votes WHERE voter_hash = $1`, [req.voterHash]),
      pool.query(`SELECT comment_id FROM comment_votes WHERE voter_hash = $1`, [req.voterHash])
    ]);

    const mediaMap = new Map();
    for (const m of mediaRes.rows) {
      const pid = Number(m.post_id);
      if (!mediaMap.has(pid)) mediaMap.set(pid, []);
      mediaMap.get(pid).push({ type: m.type, url: m.url });
    }

    const commentMap = new Map();
    for (const c of commentsRes.rows) {
      const pid = Number(c.post_id);
      if (!commentMap.has(pid)) commentMap.set(pid, []);
      commentMap.get(pid).push(c);
    }

    const posts = postsRes.rows.map((p) => {
      const pid = Number(p.id);
      return formatPostRow(p, mediaMap.get(pid) || [], buildCommentTree(commentMap.get(pid) || []));
    });

    res.json({
      posts,
      votedPostIds: postVotesRes.rows.map((v) => Number(v.post_id)),
      votedCommentIds: commentVotesRes.rows.map((v) => Number(v.comment_id))
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/posts/:id (increments view count)
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid post id' });

    const { rows } = await pool.query(
      `UPDATE posts SET views = views + 1 WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Post not found' });

    const [mediaRes, commentsRes] = await Promise.all([
      pool.query(`SELECT type, url FROM post_media WHERE post_id = $1 ORDER BY position ASC, id ASC`, [id]),
      pool.query(`SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC`, [id])
    ]);

    res.json({ post: formatPostRow(rows[0], mediaRes.rows, buildCommentTree(commentsRes.rows)) });
  } catch (err) {
    next(err);
  }
});

// POST /api/posts
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const title = String(req.body?.title || '').trim().slice(0, 120);
    const body = String(req.body?.body || '').trim().slice(0, 5000);
    const url = String(req.body?.url || '').trim().slice(0, 500);
    const category = ALLOWED_CATEGORIES.has(req.body?.category) ? req.body.category : 'Random';
    const domain = String(req.body?.domain || 'random').slice(0, 30);
    const tone = ALLOWED_TONES.has(req.body?.tone) ? req.body.tone : 'sage';
    const media = sanitizeMedia(req.body?.media);

    if (!title || !body) return res.status(400).json({ error: 'Title and content are required' });
    if (!isSafeUrl(url, false)) return res.status(400).json({ error: 'Reference URL must start with http:// or https://' });
    if (category === 'General' && !req.admin) {
      return res.status(403).json({ error: 'Only administrators may publish in General Notices' });
    }

    const author = req.admin ? req.admin.name : String(req.body?.author || '').trim().slice(0, 40);
    const authorRole = req.admin ? 'admin' : 'member';
    if (!author) return res.status(400).json({ error: 'Author name is required' });
    if (!req.admin && (await isReservedName(author))) {
      return res.status(403).json({ error: 'That name is reserved for administrators' });
    }

    const firstLine = body.split('\n')[0];
    const summary = firstLine.length > 180 ? `${firstLine.slice(0, 177)}…` : firstLine;

    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO posts (title, summary, body, url, category, domain, tone, author, author_role, upvotes, views)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, 1)
       RETURNING *`,
      [title, summary, body, url, category, domain, tone, author, authorRole]
    );
    const post = rows[0];

    for (const m of media) {
      await client.query(
        `INSERT INTO post_media (post_id, type, url, position) VALUES ($1, $2, $3, $4)`,
        [post.id, m.type, m.url, m.position]
      );
    }

    await client.query(
      `INSERT INTO post_votes (post_id, voter_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [post.id, req.voterHash]
    );
    await client.query('COMMIT');

    res.status(201).json({
      post: formatPostRow(post, media.map(({ type, url: mUrl }) => ({ type, url: mUrl })), [])
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /api/posts/:id
router.patch('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid post id' });

    const existingRes = await client.query(`SELECT * FROM posts WHERE id = $1`, [id]);
    const existing = existingRes.rows[0];
    if (!existing) return res.status(404).json({ error: 'Post not found' });

    const category = ALLOWED_CATEGORIES.has(req.body?.category) ? req.body.category : existing.category;
    if ((existing.category === 'General' || category === 'General') && !req.admin) {
      return res.status(403).json({ error: 'Only administrators may edit General Notices' });
    }

    const title = String(req.body?.title ?? existing.title).trim().slice(0, 120);
    const body = String(req.body?.body ?? existing.body).trim().slice(0, 5000);
    const url = String(req.body?.url ?? existing.url).trim().slice(0, 500);
    const domain = String(req.body?.domain ?? existing.domain).slice(0, 30);
    const tone = ALLOWED_TONES.has(req.body?.tone) ? req.body.tone : existing.tone;

    if (!title || !body) return res.status(400).json({ error: 'Title and content are required' });
    if (!isSafeUrl(url, false)) return res.status(400).json({ error: 'Reference URL must start with http:// or https://' });

    const firstLine = body.split('\n')[0];
    const summary = firstLine.length > 180 ? `${firstLine.slice(0, 177)}…` : firstLine;

    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE posts
       SET title = $1, summary = $2, body = $3, url = $4, category = $5,
           domain = $6, tone = $7, edited_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [title, summary, body, url, category, domain, tone, id]
    );

    let savedMedia = [];
    let removedUrls = [];
    if (Array.isArray(req.body?.media)) {
      const oldMediaRes = await client.query(`SELECT url FROM post_media WHERE post_id = $1`, [id]);
      const media = sanitizeMedia(req.body.media);
      const nextUrlSet = new Set(media.map((m) => m.url));
      removedUrls = oldMediaRes.rows.map((r) => r.url).filter((u) => !nextUrlSet.has(u));

      await client.query(`DELETE FROM post_media WHERE post_id = $1`, [id]);
      for (const m of media) {
        await client.query(
          `INSERT INTO post_media (post_id, type, url, position) VALUES ($1, $2, $3, $4)`,
          [id, m.type, m.url, m.position]
        );
      }
      savedMedia = media.map(({ type, url: mUrl }) => ({ type, url: mUrl }));
    } else {
      const mRes = await client.query(
        `SELECT type, url FROM post_media WHERE post_id = $1 ORDER BY position ASC, id ASC`,
        [id]
      );
      savedMedia = mRes.rows;
    }

    const commentsRes = await client.query(
      `SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    await client.query('COMMIT');

    if (removedUrls.length) await unlinkLocalUploads(removedUrls);

    res.json({ post: formatPostRow(rows[0], savedMedia, buildCommentTree(commentsRes.rows)) });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// DELETE /api/posts/:id (Admin only)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid post id' });

    const mediaRes = await pool.query(`SELECT url FROM post_media WHERE post_id = $1`, [id]);
    const { rowCount } = await pool.query(`DELETE FROM posts WHERE id = $1`, [id]);
    if (!rowCount) return res.status(404).json({ error: 'Post not found' });

    await unlinkLocalUploads(mediaRes.rows.map((r) => r.url));
    res.json({ ok: true, id });
  } catch (err) {
    next(err);
  }
});

export default router;