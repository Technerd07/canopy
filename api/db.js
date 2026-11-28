import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

export async function initDb() {
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
      id          SERIAL PRIMARY KEY,
      admin_id    INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      token_hash  CHAR(64) UNIQUE NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at  TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id           BIGSERIAL PRIMARY KEY,
      title        VARCHAR(120) NOT NULL,
      summary      VARCHAR(200) NOT NULL,
      body         TEXT NOT NULL,
      url          TEXT NOT NULL DEFAULT '',
      category     VARCHAR(40) NOT NULL,
      domain       VARCHAR(30) NOT NULL DEFAULT 'random',
      tone         VARCHAR(20) NOT NULL DEFAULT 'sage',
      author       VARCHAR(80) NOT NULL,
      author_role  VARCHAR(16) NOT NULL DEFAULT 'member',
      upvotes      INTEGER NOT NULL DEFAULT 1,
      views        INTEGER NOT NULL DEFAULT 1,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      edited_at    TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS post_media (
      id        BIGSERIAL PRIMARY KEY,
      post_id   BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      type      VARCHAR(12) NOT NULL CHECK (type IN ('image', 'video')),
      url       TEXT NOT NULL,
      position  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS comments (
      id           BIGSERIAL PRIMARY KEY,
      post_id      BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      parent_id    BIGINT REFERENCES comments(id) ON DELETE CASCADE,
      author       VARCHAR(80) NOT NULL,
      author_role  VARCHAR(16) NOT NULL DEFAULT 'member',
      text         TEXT NOT NULL,
      upvotes      INTEGER NOT NULL DEFAULT 1,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS post_votes (
      post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      voter_hash  CHAR(64) NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, voter_hash)
    );

    CREATE TABLE IF NOT EXISTS comment_votes (
      comment_id  BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      voter_hash  CHAR(64) NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (comment_id, voter_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_post_media_order ON post_media(post_id, position);
    CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
  `);
}