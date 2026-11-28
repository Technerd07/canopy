import express from 'express';
import { pool } from '../db.js';
import { requireAdmin, isReservedName } from '../middleware/auth.js';

const router = express.Router();

// POST /api/posts/:postId/comments
router.post('/posts/:postId/comments', async (req, res, next) => {
  try {
    const postId = Number(req.params.postId);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json({ error: 'Invalid post id' });
    }

    const postCheck = await pool.query(`SELECT 1 FROM posts WHERE id = $1`, [postId]);
    if (!postCheck.rows[0]) return res.status(404).json({ error: 'Post not found' });

    const text = String(req.body?.text || '').trim().slice(0, 600);
    const parentId = req.body?.parentId ? Number(req.body.parentId) : null;
    if (!text) return res.status(400).json({ error: 'Comment text is required' });

    if (parentId !== null) {
      if (!Number.isInteger(parentId) || parentId <= 0) {
        return res.status(400).json({ error: 'Invalid parent comment id' });
      }
      const parentCheck = await pool.query(
        `SELECT 1 FROM comments WHERE id = $1 AND post_id = $2`,
        [parentId, postId]
      );
      if (!parentCheck.rows[0]) return res.status(404).json({ error: 'Parent comment not found' });
    }

    const author = req.admin ? req.admin.name : String(req.body?.author || '').trim().slice(0, 40);
    const authorRole = req.admin ? 'admin' : 'member';
    if (!author) return res.status(400).json({ error: 'Author name is required' });
    if (!req.admin && (await isReservedName(author))) {
      return res.status(403).json({ error: 'That name is reserved for administrators' });
    }

    const { rows } = await pool.query(
      `INSERT INTO comments (post_id, parent_id, author, author_role, text, upvotes)
       VALUES ($1, $2, $3, $4, $5, 1)
       RETURNING *`,
      [postId, parentId, author, authorRole, text]
    );

    const c = rows[0];
    await pool.query(
      `INSERT INTO comment_votes (comment_id, voter_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [c.id, req.voterHash]
    );

    res.status(201).json({
      comment: {
        id: Number(c.id),
        postId: Number(c.post_id),
        parentId: c.parent_id ? Number(c.parent_id) : null,
        author: c.author,
        authorRole: c.author_role,
        text: c.text,
        upvotes: c.upvotes,
        createdAt: c.created_at,
        replies: []
      }
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/comments/:id (Admin only)
router.delete('/comments/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid comment id' });
    const { rowCount } = await pool.query(`DELETE FROM comments WHERE id = $1`, [id]);
    if (!rowCount) return res.status(404).json({ error: 'Comment not found' });
    res.json({ ok: true, id });
  } catch (err) {
    next(err);
  }
});

export default router;