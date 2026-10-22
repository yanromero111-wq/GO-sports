// Camada de dados: SQLite embutido do Node (padrão, zero configuração) ou Postgres (se DATABASE_URL existir).
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA_SQLITE = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  profile TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  lp_total INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ratings (
  user_id INTEGER NOT NULL,
  sport TEXT NOT NULL,
  lp INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, sport)
);
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sport TEXT NOT NULL,
  mode TEXT NOT NULL,
  won INTEGER NOT NULL,
  my_score INTEGER NOT NULL,
  opp_score INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ratings_sport ON ratings (sport, lp DESC);
`;

const SCHEMA_PG = SCHEMA_SQLITE
  .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
  .replace(/created_at INTEGER/g, 'created_at BIGINT')
  .replace(/updated_at INTEGER/g, 'updated_at BIGINT');

async function sqliteAdapter(file) {
  const { DatabaseSync } = await import('node:sqlite');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA_SQLITE);
  return {
    kind: 'sqlite',
    async all(sql, params = []) { return db.prepare(sql).all(...params); },
    async get(sql, params = []) { return db.prepare(sql).get(...params); },
    async run(sql, params = []) { return db.prepare(sql).run(...params); },
  };
}

async function pgAdapter(url) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  await pool.query(SCHEMA_PG);
  const conv = (sql) => { let i = 0; return sql.replace(/\?/g, () => '$' + ++i); };
  return {
    kind: 'postgres',
    async all(sql, params = []) { return (await pool.query(conv(sql), params)).rows; },
    async get(sql, params = []) { return (await pool.query(conv(sql), params)).rows[0]; },
    async run(sql, params = []) { return pool.query(conv(sql), params); },
  };
}

export async function createDb() {
  const raw = process.env.DATABASE_URL
    ? await pgAdapter(process.env.DATABASE_URL)
    : await sqliteAdapter(process.env.SQLITE_FILE || path.resolve('data', 'gosports.db'));
  console.log(`[db] usando ${raw.kind}`);

  return {
    kind: raw.kind,
    async getUserByName(username) {
      return raw.get('SELECT * FROM users WHERE username_key = ?', [username.toLowerCase()]);
    },
    async getUserById(id) {
      return raw.get('SELECT * FROM users WHERE id = ?', [id]);
    },
    async createUser(username, passHash, profile) {
      const now = Date.now();
      const row = await raw.get(
        'INSERT INTO users (username, username_key, pass_hash, profile, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
        [username, username.toLowerCase(), passHash, JSON.stringify(profile), now, now],
      );
      return row.id;
    },
    async saveProfile(userId, profile, meta) {
      await raw.run('UPDATE users SET profile = ?, level = ?, xp = ?, lp_total = ?, updated_at = ? WHERE id = ?', [
        JSON.stringify(profile), meta.level, meta.xp, meta.lpTotal, Date.now(), userId,
      ]);
      for (const [sport, r] of Object.entries(profile.ratings || {})) {
        await raw.run(
          `INSERT INTO ratings (user_id, sport, lp, wins, losses) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (user_id, sport) DO UPDATE SET lp = excluded.lp, wins = excluded.wins, losses = excluded.losses`,
          [userId, sport, r.lp | 0, r.w | 0, r.l | 0],
        );
      }
    },
    async createSession(token, userId) {
      await raw.run('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)', [token, userId, Date.now()]);
    },
    async getSession(token) {
      return raw.get('SELECT * FROM sessions WHERE token = ?', [token]);
    },
    async deleteSession(token) {
      await raw.run('DELETE FROM sessions WHERE token = ?', [token]);
    },
    async addMatch(userId, r) {
      await raw.run('INSERT INTO matches (user_id, sport, mode, won, my_score, opp_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        userId, r.sport, r.mode, r.won ? 1 : 0, r.myScore, r.oppScore, Date.now(),
      ]);
    },
    async leaderboard(sport, limit = 50) {
      if (sport && sport !== 'all') {
        return raw.all(
          `SELECT u.username, u.level, r.lp, r.wins, r.losses FROM ratings r JOIN users u ON u.id = r.user_id
           WHERE r.sport = ? AND (r.wins + r.losses) > 0 ORDER BY r.lp DESC, r.wins DESC LIMIT ?`,
          [sport, limit],
        );
      }
      return raw.all('SELECT username, level, xp, lp_total AS lp FROM users ORDER BY lp_total DESC, xp DESC LIMIT ?', [limit]);
    },
  };
}
