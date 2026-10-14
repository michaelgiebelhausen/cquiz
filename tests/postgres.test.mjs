import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import pg from "pg";
import { PostgresStore } from "../server/postgres-store.mjs";
import { createApp } from "../server/index.mjs";
import * as E from "../server/engine.mjs";
import { bank, roster } from "./fixtures.mjs";

test("PostgreSQL persists sessions, transactional evidence, durable job leases and hosted clocks across app instances", async () => {
  const db = await PGlite.create();
  const socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await socket.start();
  const pool = new pg.Pool({
    host: "127.0.0.1",
    port: socket.server.address().port,
    user: "postgres",
    database: "postgres",
    max: 1,
    ssl: false,
  });
  const store = new PostgresStore(pool);
  let server;
  try {
    await store.migrate();
    const e = E.createExam("Hosted test", "rehearsal", bank(), roster(), {
      ...E.defaultSettings,
      roundSeconds: 30,
      transitionSeconds: 10,
    });
    e.roster.forEach((s) => {
      s.joined = true;
      s.preflight = true;
    });
    const now = Date.now();
    E.startExam(e, now - 120000, new Set(e.roster.map((s) => s.id)));
    await store.create(e);
    const session = await store.session("student", e.id, "001");
    assert.equal((await store.authenticate(session.token)).student_id, "001");
    await assert.rejects(store.session("student", e.id, "001"), {
      status: 409,
    });
    await assert.rejects(
      store.update(e.id, "bad", (x) => {
        x.name = "lost";
        throw new Error("rollback");
      }),
    );
    assert.equal((await store.get(e.id)).name, "Hosted test");
    assert.equal((await store.audit(e.id)).length, 1);
    await store.throttle("shared-attempt", 1);
    await assert.rejects(
      new PostgresStore(pool).throttle("shared-attempt", 1),
      { status: 429 },
    );
    await store.setConfig("provider", { model: "old/model" });
    const stale = await store.config("provider");
    await store.setConfig("provider", { model: "new/model" });
    assert.equal(
      await store.compareSetConfig("provider", stale, {
        model: "old/model",
        testedAt: 1,
      }),
      false,
    );
    assert.equal((await store.config("provider")).model, "new/model");
    const options = {
      store,
      serverless: true,
      password: "hosted-test-password",
      encryptionKey: "a".repeat(64),
      origin: "https://exam.test",
      secure: false,
    };
    const first = await createApp(options);
    assert.equal(
      (await store.get(e.id)).paused,
      false,
      "cold start must not pause the exam",
    );
    first.stopAccepting();
    const second = await createApp(options);
    server = second.app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/student/state`,
      { headers: { Cookie: `cquiz_session=${session.token}` } },
    );
    assert.equal(response.status, 200);
    const saved = await store.get(e.id);
    assert.equal(saved.status, "completed");
    assert.equal(saved.round, 3);
    assert.equal(
      saved.completedAt,
      now - 10000,
      "deadlines use elapsed exam time",
    );
    await store.update(e.id, "lease-fixture", (x) => {
      x.responses.push({
        id: "pending-job",
        evaluation: { status: "grading", leaseUntil: Date.now() - 1 },
      });
      return {};
    });
    assert.deepEqual(await store.pendingJobs(), [
      { examId: e.id, responseId: "pending-job" },
    ]);
    await store.update(e.id, "active-lease", (x) => {
      x.responses[0].evaluation.leaseUntil = Date.now() + 90000;
      return {};
    });
    assert.deepEqual(await store.pendingJobs(), []);
    assert.ok((await store.audit(e.id)).length >= 4);
    const late = E.createExam("Deadline test", "rehearsal", bank(), roster(), {
      ...E.defaultSettings,
      roundSeconds: 30,
    });
    late.roster.forEach((s) => {
      s.joined = true;
      s.preflight = true;
    });
    const connected = new Set(late.roster.map((s) => s.id));
    E.startExam(late, now, connected);
    E.volunteer(late, "001", now + 1);
    E.tick(late, now + late.settings.invitationSeconds * 1000 + 1, connected);
    late.deadline = Date.now() - 1;
    await store.create(late);
    const lateSession = await store.session("student", late.id, "001");
    await store.claimTick(late.id);
    const rejected = await fetch(
      `http://127.0.0.1:${server.address().port}/api/student/draft`,
      {
        method: "POST",
        headers: {
          Origin: "https://exam.test",
          Cookie: `cquiz_session=${lateSession.token}`,
          "X-CSRF-Token": lateSession.csrf,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          responseId: late.responses[0].id,
          version: 1,
          text: "Late new text",
        }),
      },
    );
    assert.equal(rejected.status, 409);
    assert.equal((await store.get(late.id)).responses[0].text, "");
    second.stopAccepting();
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await pool.end();
    await socket.stop();
    await db.close();
  }
});
