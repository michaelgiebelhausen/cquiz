import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";
import { createApp } from "../server/index.mjs";
import { Store } from "../server/store.mjs";
import { bank, roster, evaluation } from "./fixtures.mjs";
import { toCSV } from "../server/imports.mjs";
const origin = "https://exam.test";
function client(base) {
  let cookie = "",
    csrf = "";
  return {
    async call(path, body, extra = {}) {
      const isForm = body instanceof FormData;
      const res = await fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Origin: origin,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body !== undefined
            ? {
                "X-CSRF-Token": csrf,
                ...(isForm ? {} : { "Content-Type": "application/json" }),
              }
            : {}),
          ...extra,
        },
        body:
          body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      });
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      const type = res.headers.get("content-type") || "";
      const data = type.includes("application/json")
        ? await res.json()
        : await res.text();
      if (data.csrf) csrf = data.csrf;
      return { status: res.status, data, headers: res.headers };
    },
    cookie: () => cookie,
  };
}
async function running(options = {}) {
  const service = await createApp({
    dataDir: ":memory:",
    password: "test-password-long-enough",
    origin,
    secure: true,
    timers: false,
    ...options,
  });
  const server = service.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    service,
    base,
    async close() {
      await new Promise((r) => server.close(r));
      await service.close();
    },
  };
}
test("API enforces auth, CSRF, roster identity and duplicate sessions", async () => {
  const run = await running();
  try {
    const admin = client(run.base),
      anon = client(run.base);
    assert.equal((await anon.call("/api/admin/state")).status, 401);
    assert.equal(
      (await admin.call("/api/admin/login", { password: "wrong" })).status,
      401,
    );
    assert.equal(
      (
        await admin.call("/api/admin/login", {
          password: "test-password-long-enough",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await admin.call("/api/admin/exams", {
          name: "Exam",
          mode: "rehearsal",
        })
      ).status,
      400,
    );
    run.service.store.setConfig("bank", bank());
    run.service.store.setConfig("roster", roster());
    const created = await admin.call("/api/admin/exams", {
      name: "Exam",
      mode: "rehearsal",
    });
    const id = created.data.id;
    assert.equal(created.status, 201);
    const alice = client(run.base),
      imposter = client(run.base);
    assert.equal(
      (
        await alice.call("/api/student/join", {
          examId: id,
          email: "wrong@example.edu",
          studentId: "001",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await alice.call("/api/student/join", {
          examId: id,
          email: roster()[0].email,
          studentId: "001",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await imposter.call("/api/student/join", {
          examId: id,
          email: roster()[0].email,
          studentId: "001",
        })
      ).status,
      409,
    );
    assert.equal((await alice.call("/api/admin/state")).status, 401);
    assert.equal(
      (
        await alice.call(
          "/api/student/preflight",
          { passed: true },
          { "X-CSRF-Token": "wrong" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await alice.call(
          "/api/student/preflight",
          { passed: true },
          { Origin: "https://evil.test" },
        )
      ).status,
      403,
    );
    const state = await alice.call("/api/student/state");
    assert.ok(!JSON.stringify(state.data).includes("ideal_insight"));
    assert.ok(!("ranking" in state.data));
    assert.ok(!JSON.stringify(state.data).includes("student02@example.edu"));
    assert.equal(
      (
        await admin.call(`/api/admin/exams/${id}/action`, {
          action: "release",
          studentId: "001",
        })
      ).status,
      200,
    );
    assert.equal((await alice.call("/api/student/state")).status, 401);
  } finally {
    await run.close();
  }
});
test("uploads validate files and keep exams frozen when bank changes", async () => {
  const run = await running();
  try {
    const admin = client(run.base);
    await admin.call("/api/admin/login", {
      password: "test-password-long-enough",
    });
    const csv = toCSV(
      bank().flatMap((q) =>
        q.insights.map((i) => ({
          question_id: q.id,
          topic: q.topic,
          prompt: q.prompt,
          insight_id: i.id,
          ideal_insight: i.text,
          weight: i.weight,
          grading_guidance: i.guidance,
          source_reference: i.source,
          difficulty: q.difficulty,
        })),
      ),
    );
    const form = new FormData();
    form.append("file", new Blob([csv]), "bank.csv");
    assert.equal(
      (await admin.call("/api/admin/import/bank", form)).status,
      200,
    );
    const rf = new FormData();
    rf.append(
      "file",
      new Blob([
        toCSV(
          roster().map((s) => ({
            school_email: s.email,
            student_id: s.id,
            display_name: s.name,
          })),
        ),
      ]),
      "roster.csv",
    );
    assert.equal(
      (await admin.call("/api/admin/import/roster", rf)).status,
      200,
    );
    const made = await admin.call("/api/admin/exams", {
      name: "Frozen bank",
      mode: "rehearsal",
    });
    run.service.store.setConfig("bank", bank(3));
    assert.equal(run.service.store.get(made.data.id).bank.length, 12);
    const invalid = new FormData();
    invalid.append("file", new Blob(["bad"]), "bad.exe");
    assert.equal(
      (await admin.call("/api/admin/import/bank", invalid)).status,
      400,
    );
  } finally {
    await run.close();
  }
});
test("full API turn collects live text, early peer ratings, grading and flag inclusion", async () => {
  const run = await running();
  try {
    const { service } = run;
    service.store.setConfig("bank", bank());
    service.store.setConfig("roster", roster());
    const admin = client(run.base);
    await admin.call("/api/admin/login", {
      password: "test-password-long-enough",
    });
    const {
      data: { id },
    } = await admin.call("/api/admin/exams", {
      name: "Rehearsal",
      mode: "rehearsal",
    });
    const students = await Promise.all(
      roster().map(async (s) => {
        const c = client(run.base);
        await c.call("/api/student/join", {
          examId: id,
          email: s.email,
          studentId: s.id,
        });
        await c.call("/api/student/preflight", { passed: true });
        return c;
      }),
    );
    assert.equal(
      (await admin.call(`/api/admin/exams/${id}/action`, { action: "start" }))
        .status,
      200,
    );
    await students[0].call("/api/student/volunteer", {});
    service.update(id, "test-clock", (e) => {
      const inv = e.invitations[0];
      inv.closesAt = 0;
      return {};
    });
    const E = await import("../server/engine.mjs");
    service.update(id, "test-tick", (e) => {
      E.tick(e, Date.now(), service.store.online(id));
      return {};
    });
    const speaker = (await students[0].call("/api/student/state")).data;
    assert.equal(speaker.table.speaker.id, speaker.person.id);
    assert.notEqual(speaker.table.speaker.id, "001");
    const r = speaker.currentOwn.id;
    assert.equal(
      (
        await students[1].call("/api/student/rate", {
          responseId: r,
          values: [4, 4, 5],
        })
      ).status,
      200,
    );
    await students[0].call("/api/student/draft", {
      responseId: r,
      version: 1,
      text: "Use clear goals and context.",
    });
    const finished = await students[0].call("/api/student/finish", {
      responseId: r,
      text: "Use clear goals and context.",
      requestId: "request-unique-001",
    });
    assert.equal(finished.status, 200);
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(service.store.get(id).responses[0].evaluation.status, "done");
    const points = service.store
      .get(id)
      .ranking.find((s) => s.id === "001").points;
    assert.ok(points > 0);
    await students[0].call("/api/student/flag", { responseId: r });
    assert.equal(
      service.store.get(id).ranking.find((s) => s.id === "001").points,
      points,
    );
    assert.equal(
      (
        await students[0].call("/api/student/finish", {
          text: "replacement",
          requestId: "request-unique-001",
        })
      ).status,
      200,
    );
    assert.equal(
      service.store.get(id).responses[0].text,
      "Use clear goals and context.",
    );
    const data = (await admin.call(`/api/admin/exams/${id}/export`)).data;
    assert.ok(data.audit.length > 0);
    assert.equal(data.resultStatus, "REHEARSAL");
  } finally {
    await run.close();
  }
});
test("live mode requires a tested provider and never uses rehearsal on provider failure", async () => {
  let fail = false;
  const run = await running({
    evaluator: async (config, q) => {
      if (fail) throw new Error("Provider down");
      return { ...evaluation([q.insights[0].id]), depth: 1 };
    },
  });
  try {
    const { service } = run;
    service.store.setConfig("bank", bank());
    service.store.setConfig("roster", roster());
    const admin = client(run.base);
    await admin.call("/api/admin/login", {
      password: "test-password-long-enough",
    });
    const {
      data: { id },
    } = await admin.call("/api/admin/exams", {
      name: "Live exam",
      mode: "live",
    });
    const students = await Promise.all(
      roster().map(async (s) => {
        const c = client(run.base);
        await c.call("/api/student/join", {
          examId: id,
          email: s.email,
          studentId: s.id,
        });
        await c.call("/api/student/preflight", { passed: true });
        return c;
      }),
    );
    assert.equal(
      (await admin.call(`/api/admin/exams/${id}/action`, { action: "start" }))
        .status,
      409,
    );
    assert.equal(
      (
        await admin.call("/api/admin/provider", {
          key: "synthetic-key-for-testing",
          model: "test/model",
          zdr: true,
        })
      ).status,
      200,
    );
    assert.equal(
      (await admin.call("/api/admin/provider/test", {})).status,
      200,
    );
    assert.equal(
      (await admin.call(`/api/admin/exams/${id}/action`, { action: "start" }))
        .status,
      200,
    );
    assert.equal(
      (
        await admin.call("/api/admin/provider", {
          key: "another-synthetic-key",
          model: "changed/model",
          zdr: true,
        })
      ).status,
      409,
    );
    const E = await import("../server/engine.mjs");
    await students[0].call("/api/student/volunteer", {});
    service.update(id, "test-tick", (e) => {
      e.invitations[0].closesAt = 0;
      E.tick(e, Date.now(), service.store.online(id));
      return {};
    });
    fail = true;
    await students[0].call("/api/student/finish", {
      responseId: service.store.get(id).tables[0].currentResponseId,
      text: "Saved even when provider fails.",
      requestId: "failure-request-001",
    });
    await new Promise((r) => setTimeout(r, 150));
    const response = service.store.get(id).responses[0];
    assert.equal(response.evaluation.status, "error");
    assert.equal(response.points, 0);
    assert.equal(response.text, "Saved even when provider fails.");
    fail = false;
    await admin.call(`/api/admin/exams/${id}/action`, {
      action: "retry",
      responseId: response.id,
    });
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(service.store.get(id).responses[0].evaluation.status, "done");
    const exported = (await admin.call(`/api/admin/exams/${id}/export`)).data;
    assert.ok(!JSON.stringify(exported).includes("synthetic-key"));
  } finally {
    await run.close();
  }
});
test("SQLite survives restart and audit contains only committed mutations", () => {
  const path = mkdtempSync(join(tmpdir(), "cquiz-store-"));
  try {
    let s = new Store(path);
    const e = { id: "durable", revision: 1, responses: [], name: "Exam" };
    s.create(e);
    assert.throws(() =>
      s.update("durable", "failed", (e) => {
        e.name = "lost";
        throw new Error("rollback");
      }),
    );
    assert.equal(s.get("durable").name, "Exam");
    s.update("durable", "saved", (e) => {
      e.responses.push({ text: "Persistent evidence" });
      return { count: 1 };
    });
    s.close();
    s = new Store(path);
    assert.equal(s.get("durable").responses[0].text, "Persistent evidence");
    assert.equal(
      s.audit("durable").filter((e) => e.type === "failed").length,
      0,
    );
    s.close();
  } finally {
    assert(!relative(resolve(tmpdir()), resolve(path)).startsWith(".."));
    rmSync(path, { recursive: true, force: true });
  }
});
