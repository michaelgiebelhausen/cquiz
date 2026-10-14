import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { randomBytes } from "node:crypto";
import { hash } from "./store.mjs";
import { assert, AppError } from "./imports.mjs";
export const POSTGRES_SCHEMA = `
CREATE TABLE IF NOT EXISTS cquiz_exams(id TEXT PRIMARY KEY,body JSONB NOT NULL,tick_claimed_at BIGINT NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS cquiz_config(id TEXT PRIMARY KEY,body JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS cquiz_sessions(token TEXT PRIMARY KEY,role TEXT NOT NULL,exam_id TEXT,student_id TEXT,csrf TEXT NOT NULL,expires BIGINT NOT NULL,seen BIGINT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS cquiz_student_session ON cquiz_sessions(exam_id,student_id) WHERE role='student';
CREATE INDEX IF NOT EXISTS cquiz_session_presence ON cquiz_sessions(exam_id,seen);
CREATE TABLE IF NOT EXISTS cquiz_audit(seq BIGSERIAL PRIMARY KEY,exam_id TEXT NOT NULL,time BIGINT NOT NULL,type TEXT NOT NULL,body JSONB NOT NULL);
CREATE INDEX IF NOT EXISTS cquiz_audit_exam ON cquiz_audit(exam_id,seq);
CREATE TABLE IF NOT EXISTS cquiz_rate_limits(id TEXT PRIMARY KEY,times JSONB NOT NULL,updated_at BIGINT NOT NULL);
`;
export class PostgresStore {
  constructor(pool) {
    this.pool = pool;
  }
  static async connect(url) {
    assert(url, "DATABASE_URL is required on Vercel.", 500);
    const pool = new pg.Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000,
    });
    if (process.env.VERCEL) attachDatabasePool(pool);
    const store = new PostgresStore(pool);
    await store.migrate();
    return store;
  }
  async migrate() {
    await this.pool.query(POSTGRES_SCHEMA);
  }
  hydrate(body) {
    const e = structuredClone(body);
    e.seenQuestions = Object.assign(Object.create(null), e.seenQuestions);
    for (const t of e.tables ?? [])
      t.credited = Object.assign(Object.create(null), t.credited);
    return e;
  }
  async config(id, fallback = null) {
    const { rows } = await this.pool.query(
      "SELECT body FROM cquiz_config WHERE id=$1",
      [id],
    );
    return rows[0]?.body ?? fallback;
  }
  async setConfig(id, value) {
    await this.pool.query(
      "INSERT INTO cquiz_config VALUES($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
      [id, JSON.stringify(value)],
    );
  }
  async compareSetConfig(id, expected, value) {
    return this.transaction(async (client) => {
      await client.query(
        "INSERT INTO cquiz_config VALUES($1,'{}'::jsonb) ON CONFLICT(id) DO NOTHING",
        [id],
      );
      const result = await client.query(
        "UPDATE cquiz_config SET body=$3::jsonb WHERE id=$1 AND body=$2::jsonb RETURNING id",
        [id, JSON.stringify(expected), JSON.stringify(value)],
      );
      return result.rows.length === 1;
    });
  }
  async get(id) {
    const { rows } = await this.pool.query(
      "SELECT body FROM cquiz_exams WHERE id=$1",
      [id],
    );
    assert(rows[0], "Exam not found.", 404);
    return this.hydrate(rows[0].body);
  }
  async list() {
    const { rows } = await this.pool.query(
      "SELECT body FROM cquiz_exams ORDER BY body->>'createdAt'",
    );
    return rows.map((r) => this.hydrate(r.body));
  }
  async create(e) {
    await this.transaction(async (client) => {
      await client.query(
        "INSERT INTO cquiz_exams(id,body) VALUES($1,$2::jsonb)",
        [e.id, JSON.stringify(e)],
      );
      await this.record(e.id, "created", { mode: e.mode }, client);
    });
  }
  async transaction(fn) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const value = await fn(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async update(id, type, fn) {
    return this.transaction(async (client) => {
      const { rows } = await client.query(
        "SELECT body FROM cquiz_exams WHERE id=$1 FOR UPDATE",
        [id],
      );
      assert(rows[0], "Exam not found.", 404);
      const e = this.hydrate(rows[0].body),
        result = fn(e);
      assert(
        !(result instanceof Promise),
        "Exam mutations must be synchronous; external work belongs outside the transaction.",
        500,
      );
      if (result === false) return null;
      e.revision++;
      e.updatedAt = Date.now();
      await client.query("UPDATE cquiz_exams SET body=$2::jsonb WHERE id=$1", [
        id,
        JSON.stringify(e),
      ]);
      await this.record(id, type, result ?? {}, client);
      return e;
    });
  }
  async record(id, type, body, client = this.pool) {
    await client.query(
      "INSERT INTO cquiz_audit(exam_id,time,type,body) VALUES($1,$2,$3,$4::jsonb)",
      [id, Date.now(), type, JSON.stringify(body)],
    );
  }
  async audit(id) {
    const { rows } = await this.pool.query(
      "SELECT seq,time,type,body FROM cquiz_audit WHERE exam_id=$1 ORDER BY seq",
      [id],
    );
    return rows;
  }
  async session(role, examId = null, studentId = null) {
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(24).toString("hex");
    try {
      await this.transaction(async (client) => {
        await client.query("DELETE FROM cquiz_sessions WHERE expires<$1", [
          Date.now(),
        ]);
        await client.query(
          "INSERT INTO cquiz_sessions VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            hash(token),
            role,
            examId,
            studentId,
            csrf,
            Date.now() + 8 * 3600000,
            Date.now(),
          ],
        );
      });
    } catch (error) {
      if (error.code === "23505")
        throw new AppError(
          "This student is already connected. Ask the instructor to release the previous session.",
          409,
        );
      throw error;
    }
    return { token, csrf };
  }
  async authenticate(token) {
    if (!token) return null;
    const { rows } = await this.pool.query(
      "SELECT * FROM cquiz_sessions WHERE token=$1 AND expires>$2",
      [hash(token), Date.now()],
    );
    return rows[0] ?? null;
  }
  async validSessionHash(token) {
    const { rows } = await this.pool.query(
      "SELECT token FROM cquiz_sessions WHERE token=$1 AND expires>$2",
      [token, Date.now()],
    );
    return !!rows[0];
  }
  async touch(token) {
    await this.pool.query("UPDATE cquiz_sessions SET seen=$2 WHERE token=$1", [
      token,
      Date.now(),
    ]);
  }
  async online(id) {
    const { rows } = await this.pool.query(
      "SELECT student_id FROM cquiz_sessions WHERE exam_id=$1 AND role='student' AND seen>$2 AND expires>$3",
      [id, Date.now() - 30000, Date.now()],
    );
    return new Set(rows.map((r) => r.student_id));
  }
  async revoke(token) {
    await this.pool.query("DELETE FROM cquiz_sessions WHERE token=$1", [token]);
  }
  async release(id, student) {
    await this.pool.query(
      "DELETE FROM cquiz_sessions WHERE exam_id=$1 AND student_id=$2",
      [id, student],
    );
  }
  async throttle(id, max, now = Date.now()) {
    await this.transaction(async (client) => {
      await client.query(
        "INSERT INTO cquiz_rate_limits VALUES($1,'[]'::jsonb,$2) ON CONFLICT(id) DO NOTHING",
        [id, now],
      );
      const { rows } = await client.query(
        "SELECT times FROM cquiz_rate_limits WHERE id=$1 FOR UPDATE",
        [id],
      );
      const times = rows[0].times.filter((t) => t > now - 60000);
      assert(
        times.length < max,
        "Too many attempts. Wait a minute and try again.",
        429,
      );
      times.push(now);
      await client.query(
        "UPDATE cquiz_rate_limits SET times=$2::jsonb,updated_at=$3 WHERE id=$1",
        [id, JSON.stringify(times), now],
      );
    });
  }
  async claimTick(id, now = Date.now()) {
    const { rows } = await this.pool.query(
      "UPDATE cquiz_exams SET tick_claimed_at=$2 WHERE id=$1 AND tick_claimed_at<$3 AND body->>'status'='running' RETURNING id",
      [id, now, now - 500],
    );
    return rows.length > 0;
  }
  async pendingJobs(limit = 8) {
    const { rows } = await this.pool.query(
      `SELECT e.id AS "examId",r->>'id' AS "responseId" FROM cquiz_exams e CROSS JOIN LATERAL jsonb_array_elements(e.body->'responses') r WHERE r->'evaluation'->>'status'='pending' OR (r->'evaluation'->>'status'='grading' AND COALESCE((r->'evaluation'->>'leaseUntil')::bigint,0)<$1) LIMIT $2`,
      [Date.now(), limit],
    );
    return rows;
  }
  async close() {
    await this.pool.end();
  }
}
