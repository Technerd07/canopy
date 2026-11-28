import crypto from 'node:crypto';
import { pool, initDb } from './db.js';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

await initDb();

const admins = [
  { username: 'damodar', display_name: 'Damodar', title: 'Founder',    password: process.env.FOUNDER1_PASS },
  { username: 'tharun',  display_name: 'Tharun',  title: 'Co-founder', password: process.env.FOUNDER2_PASS }
];

for (const a of admins) {
  if (!a.password) {
    console.error(`Missing password env var for ${a.username}`);
    process.exit(1);
  }
  await pool.query(
    `INSERT INTO admins (username, display_name, title, password_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (username)
     DO UPDATE SET display_name = EXCLUDED.display_name,
                   title = EXCLUDED.title,
                   password_hash = EXCLUDED.password_hash`,
    [a.username, a.display_name, a.title, hashPassword(a.password)]
  );
  console.log(`Seeded admin: ${a.username} (${a.display_name} · ${a.title})`);
}

await pool.end();