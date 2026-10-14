import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { assert } from "./imports.mjs";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export class Store {
  constructor(path) {
    if (path !== ":memory:") mkdirSync(path, { recursive: true });
    this.db = new DatabaseSync(
      path === ":memory:" ? path : join(path, "cquiz.sqlite"),
    );
    this.db.exec(
      `PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS exams(id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS config(id TEXT PRIMARY KEY,body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,role TEXT NOT NULL,exam_id TEXT,student_id TEXT,csrf TEXT NOT NULL,expires INTEGER NOT NULL,seen INTEGER NOT NULL); CREATE UNIQUE INDEX IF NOT EXISTS student_session ON sessions(exam_id,student_id) WHERE role='student'; CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,exam_id TEXT NOT NULL,time INTEGER NOT NULL,type TEXT NOT NULL,body TEXT NOT NULL);`,
    );
  }
  config(id, fallback = null) {
    const row = this.db.prepare("SELECT body FROM config WHERE id=?").get(id);
    return row ? JSON.parse(row.body) : fallback;
  }
  setConfig(id, data) {
    this.db
      .prepare(
        "INSERT INTO config VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
      )
      .run(id, JSON.stringify(data));
  }
  compareSetConfig(id, expected, value) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.config(id, {});
      const matches = JSON.stringify(current) === JSON.stringify(expected);
      if (matches) this.setConfig(id, value);
      this.db.exec("COMMIT");
      return matches;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  hydrate(body) {
    const e = JSON.parse(body);
    if (e.seenQuestions)
      e.seenQuestions = Object.assign(Object.create(null), e.seenQuestions);
    for (const t of e.tables ?? [])
      t.credited = Object.assign(Object.create(null), t.credited);
    return e;
  }
  get(id) {
    const row = this.db.prepare("SELECT body FROM exams WHERE id=?").get(id);
    assert(row, "Exam not found.", 404);
    return this.hydrate(row.body);
  }
  list() {
    return this.db
      .prepare("SELECT body FROM exams")
      .all()
      .map((r) => this.hydrate(r.body));
  }
  create(exam) {
    this.db
      .prepare("INSERT INTO exams VALUES(?,?)")
      .run(exam.id, JSON.stringify(exam));
    this.record(exam.id, "created", { mode: exam.mode });
  }
  update(id, type, fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const e = this.get(id);
      const result = fn(e);
      assert(
        !(result instanceof Promise),
        "Exam mutations must be synchronous.",
        500,
      );
      if (result === false) {
        this.db.exec("COMMIT");
        return null;
      }
      e.revision++;
      e.updatedAt = Date.now();
      this.db
        .prepare("UPDATE exams SET body=? WHERE id=?")
        .run(JSON.stringify(e), id);
      this.record(id, type, result ?? {});
      this.db.exec("COMMIT");
      return e;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  record(id, type, body) {
    this.db
      .prepare("INSERT INTO audit(exam_id,time,type,body) VALUES(?,?,?,?)")
      .run(id, Date.now(), type, JSON.stringify(body));
  }
  audit(id) {
    return this.db
      .prepare(
        "SELECT seq,time,type,body FROM audit WHERE exam_id=? ORDER BY seq",
      )
      .all(id)
      .map((r) => ({ ...r, body: JSON.parse(r.body) }));
  }
  session(role, examId = null, studentId = null) {
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(24).toString("hex");
    this.db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    if (role === "student")
      assert(
        !this.db
          .prepare(
            "SELECT token FROM sessions WHERE exam_id=? AND student_id=?",
          )
          .get(examId, studentId),
        "This student is already connected. Ask the instructor to release the previous session.",
        409,
      );
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?,?,?,?,?)")
      .run(
        hash(token),
        role,
        examId,
        studentId,
        csrf,
        Date.now() + 8 * 3600000,
        Date.now(),
      );
    return { token, csrf };
  }
  authenticate(token) {
    if (!token) return null;
    return (
      this.db
        .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
        .get(hash(token), Date.now()) ?? null
    );
  }
  touch(token) {
    this.db
      .prepare("UPDATE sessions SET seen=? WHERE token=?")
      .run(Date.now(), token);
  }
  online(id) {
    return new Set(
      this.db
        .prepare(
          "SELECT student_id FROM sessions WHERE exam_id=? AND role='student' AND seen>? AND expires>?",
        )
        .all(id, Date.now() - 30000, Date.now())
        .map((r) => r.student_id),
    );
  }
  revoke(token) {
    this.db.prepare("DELETE FROM sessions WHERE token=?").run(token);
  }
  release(id, student) {
    this.db
      .prepare("DELETE FROM sessions WHERE exam_id=? AND student_id=?")
      .run(id, student);
  }
  close() {
    this.db.close();
  }
  throttle(key, max, now = Date.now()) {
    const id = `rate:${key}`,
      values = this.config(id, []).filter((t) => t > now - 60000);
    assert(
      values.length < max,
      "Too many attempts. Wait a minute and try again.",
      429,
    );
    values.push(now);
    this.setConfig(id, values);
  }
  claimTick(id, now = Date.now()) {
    const key = `clock:${id}`,
      previous = this.config(key, 0);
    if (previous > now - 500) return false;
    this.setConfig(key, now);
    return true;
  }
  pendingJobs(limit = 8) {
    return this.list()
      .flatMap((e) =>
        e.responses
          .filter(
            (r) =>
              r.evaluation.status === "pending" ||
              (r.evaluation.status === "grading" &&
                (r.evaluation.leaseUntil ?? 0) < Date.now()),
          )
          .map((r) => ({ examId: e.id, responseId: r.id })),
      )
      .slice(0, limit);
  }
  validSessionHash(token) {
    return !!this.db
      .prepare("SELECT token FROM sessions WHERE token=? AND expires>?")
      .get(token, Date.now());
  }
}
