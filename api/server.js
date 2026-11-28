import express from 'express';
import cookieParser from 'cookie-parser';
import { initDb } from './db.js';
import { attachAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import postsRoutes from './routes/posts.js';
import commentsRoutes from './routes/comments.js';
import votesRoutes from './routes/votes.js';
import uploadsRoutes from './routes/uploads.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(attachAuth);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api', commentsRoutes);
app.use('/api', votesRoutes);

app.use((err, _req, res, _next) => {
  console.error('API Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Canopy API listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });