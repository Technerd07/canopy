import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

async function toggleVote({ table, voteTable, idCol, id, voterHash }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const del = await client.query(
      `DELETE FROM ${voteTable} WHERE ${idCol} = $1 AND voter_hash = $2`,
      [id, voterHash]
    );

    let voted;
    let rows;
    if (del.rowCount > 0) {
      voted = false;
      ({ rows } = await client.query(
        `UPDATE ${table} SET upvotes = GREATEST(0, upvotes - 1) WHERE id = $1 RETURNING upvotes`,
        [id]
      ));
    } else {
      voted = true;
      ({ rows } = await client.query(
        `UPDATE ${table} SET upvotes = upvotes + 1 WHERE id = $1 RETURNING upvotes`,
        [id]
      ));
      if (rows[0]) {
        await client.query(
          `INSERT INTO ${voteTable} (${idCol}, voter_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, voterHash]
        );
      }
    }

    if (!rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query('COMMIT');
    return { voted, upvotes: rows[0].upvotes };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

router.post('/posts/:id/vote', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid post id' });
    const result = await toggleVote({
      table: 'posts',
      voteTable: 'post_votes',
      idCol: 'post_id',
      id,
      voterHash: req.voterHash
    });
    if (!result) return res.status(404).json({ error: 'Post not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/comments/:id/vote', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid comment id' });
    const result = await toggleVote({
      table: 'comments',
      voteTable: 'comment_votes',
      idCol: 'comment_id',
      id,
      voterHash: req.voterHash
    });
    if (!result) return res.status(404).json({ error: 'Comment not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;