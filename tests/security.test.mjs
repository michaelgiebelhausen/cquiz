import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../server/index.mjs";
import {
  createExam,
  startExam,
  applyEvaluation,
  prepareResponse,
  tick,
  volunteer,
  defaultSettings,
} from "../server/engine.mjs";
import { Store } from "../server/store.mjs";
import { bank, roster, evaluation } from "./fixtures.mjs";
async function running(extra = {}) {
  const service = await createApp({
      dataDir: ":memory:",
      password: "security-test-password",
      origin: "http://test.local",
      timers: false,
      ...extra,
    }),
    server = service.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    service,
    server,
    base,
    async close() {
      service.stopAccepting();
      await service.drain();
      await new Promise((r) => server.close(r));
      await service.close();
    },
  };
}
function client(base) {
  let cookie = "",
    csrf = "";
  return {
    async request(path, body, headers = {}) {
      const res = await fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Origin: "http://test.local",
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.headers.get("set-cookie"))
        cookie = res.headers.get("set-cookie").split(";")[0];
      const data = await res.json();
      if (data.csrf) csrf = data.csrf;
      return { status: res.status, data };
    },
    cookie: () => cookie,
  };
}
test("constructor and __proto__ identifiers work before and after SQLite hydration", () => {
  const r = roster();
  r[0].id = "constructor";
  const b = bank();
  b[0].insights[0].id = "__proto__";
  const e = createExam(
    "Special identifiers",
    "rehearsal",
    b,
    r,
    defaultSettings,
  );
  e.roster.forEach((s) => {
    s.joined = true;
    s.preflight = true;
  });
  const online = new Set(r.map((s) => s.id));
  startExam(e, 0, online);
  volunteer(e, "constructor", 1);
  tick(e, 12001, online);
  const response = prepareResponse(
    e,
    "constructor",
    "Correct insight.",
    "special-request",
    13000,
  );
  applyEvaluation(e, response.id, evaluation(["__proto__"]), 14000);
  assert.equal(response.points, 1);
  const store = new Store(":memory:");
  store.create(e);
  const loaded = store.get(e.id);
  assert.equal(Object.getPrototypeOf(loaded.seenQuestions), null);
  assert.equal(Object.getPrototypeOf(loaded.tables[0].credited), null);
  assert.equal(loaded.tables[0].credited.__proto__, 1);
  store.close();
});
test("forwarded IP spoofing does not bypass direct-host password throttling", async () => {
  const run = await running();
  try {
    const c = client(run.base);
    for (let i = 0; i < 8; i++)
      assert.equal(
        (
          await c.request(
            "/api/admin/login",
            { password: "wrong" },
            { "X-Forwarded-For": `192.0.2.${i + 1}` },
          )
        ).status,
        401,
      );
    assert.equal(
      (
        await c.request(
          "/api/admin/login",
          { password: "wrong" },
          { "X-Forwarded-For": "192.0.2.99" },
        )
      ).status,
      429,
    );
  } finally {
    await run.close();
  }
});
test("stale provider test cannot verify or overwrite changed settings", async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  const run = await running({
    evaluator: async (config, q) => {
      await gate;
      return evaluation([q.insights[0].id]);
    },
  });
  try {
    const c = client(run.base);
    await c.request("/api/admin/login", { password: "security-test-password" });
    await c.request("/api/admin/provider", {
      key: "synthetic-test-key-old",
      model: "old/model",
      zdr: true,
    });
    const probe = c.request("/api/admin/provider/test", {});
    await new Promise((r) => setTimeout(r, 30));
    await c.request("/api/admin/provider", {
      key: "synthetic-test-key-new",
      model: "new/model",
      zdr: false,
    });
    release();
    assert.equal((await probe).status, 409);
    const state = (await c.request("/api/admin/state")).data;
    assert.equal(state.provider.model, "new/model");
    assert.equal(state.provider.testedAt, null);
  } finally {
    release();
    await run.close();
  }
});
test("draft versions reject out-of-order and previous-turn text", async () => {
  const run = await running();
  try {
    const store = run.service.store;
    store.setConfig("bank", bank());
    store.setConfig("roster", roster());
    const admin = client(run.base);
    await admin.request("/api/admin/login", {
      password: "security-test-password",
    });
    const {
      data: { id },
    } = await admin.request("/api/admin/exams", {
      name: "Drafts",
      mode: "rehearsal",
    });
    const students = [];
    for (const s of roster()) {
      const c = client(run.base);
      await c.request("/api/student/join", {
        examId: id,
        email: s.email,
        studentId: s.id,
      });
      await c.request("/api/student/preflight", { passed: true });
      students.push(c);
    }
    await admin.request(`/api/admin/exams/${id}/action`, { action: "start" });
    await students[0].request("/api/student/volunteer", {});
    run.service.update(id, "test-clock", (e) => {
      e.invitations[0].closesAt = 0;
      tick(e, Date.now(), store.online(id));
      return {};
    });
    const responseId = store.get(id).tables[0].currentResponseId;
    assert.equal(
      (
        await students[0].request("/api/student/draft", {
          responseId,
          version: 2,
          text: "Newer words.",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await students[0].request("/api/student/draft", {
          responseId,
          version: 1,
          text: "Older words.",
        })
      ).status,
      200,
    );
    assert.equal(store.get(id).responses[0].text, "Newer words.");
    assert.equal(
      (
        await students[0].request("/api/student/draft", {
          responseId: "previous-turn",
          version: 3,
          text: "Stale turn.",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await students[0].request("/api/student/finish", {
          responseId: "previous-turn",
          requestId: "stale-submission",
          text: "Stale turn.",
        })
      ).status,
      409,
    );
    assert.equal(store.get(id).responses[0].text, "Newer words.");
  } finally {
    await run.close();
  }
});
test("shutdown ends connected event streams before closing the HTTP server", async () => {
  const run = await running();
  const c = client(run.base);
  await c.request("/api/admin/login", { password: "security-test-password" });
  const request = http.get(run.base + "/api/events", {
    headers: { Cookie: c.cookie() },
  });
  const response = await new Promise((r) => request.once("response", r));
  response.resume();
  const start = Date.now();
  await run.close();
  assert.ok(Date.now() - start < 2000);
  request.destroy();
});
