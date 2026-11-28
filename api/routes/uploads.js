import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';

const router = express.Router();

export const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB per file
const MAX_FILES = 10;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov'
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || '';
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (!MIME_TO_EXT[file.mimetype]) {
      return cb(new Error('Unsupported file type. Allowed: JPG, PNG, WebP, GIF, AVIF, MP4, WebM, MOV.'));
    }
    cb(null, true);
  }
});

router.post('/', (req, res) => {
  upload.array('files', MAX_FILES)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File exceeds the 50 MB limit' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: `Maximum ${MAX_FILES} media files per post` });
        }
      }
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }

    const media = (req.files || []).map((f) => ({
      type: f.mimetype.startsWith('video/') ? 'video' : 'image',
      url: `/uploads/${f.filename}`
    }));

    res.status(201).json({ media });
  });
});

export default router;