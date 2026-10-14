import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import * as E from "../server/engine.mjs";
import { recalculate } from "../server/scoring.mjs";
import { bank, roster, evaluation } from "./fixtures.mjs";
test("100-person exam simulates three complete rounds with all responses and diagnostics", () => {
  const e = E.createExam(
    "Hundred participant simulation",
    "rehearsal",
    bank(100),
    roster(100),
    {
      ...E.defaultSettings,
      roundSeconds: 900,
      transitionSeconds: 300,
      invitationSeconds: 5,
    },
  );
  e.roster.forEach((s) => {
    s.joined = true;
    s.preflight = true;
  });
  const online = new Set(e.roster.map((s) => s.id));
  let now = 0;
  E.startExam(e, now, online);
  for (let round = 1; round <= 3; round++) {
    for (let contribution = 0; contribution < 3; contribution++) {
      for (const t of e.tables) {
        const inv = e.invitations.find((i) => i.id === t.invitationId);
        assert.ok(inv);
        for (const id of inv.eligible) E.volunteer(e, id, now + 1);
      }
      now += 5001;
      E.tick(e, now, online);
      for (const t of e.tables) {
        assert.equal(t.phase, "speaking");
        const q = e.bank.find((q) => q.id === t.questionId),
          index = contribution % q.insights.length,
          r = E.prepareResponse(
            e,
            t.speakerId,
            `Synthetic insight ${index}`,
            `request-${round}-${contribution}-${t.id}`,
            now + 1,
          );
        E.applyEvaluation(e, r.id, evaluation([q.insights[index].id]), now + 2);
        for (const id of r.expectedRaters)
          E.rate(e, id, r.id, [3 + (Number(id) % 3), 4, 4], now + 3);
      }
      now += 4;
      E.tick(e, now, online);
    }
    E.endRound(e, now + 1);
    for (const g of e.groups[round - 1])
      for (const id of g.members)
        for (const other of g.members)
          if (id !== other) E.diagnostic(e, id, other, [4, 4], now + 2);
    if (round < 3) {
      now += 300002;
      E.nextRound(e, now, online);
    }
  }
  assert.equal(e.status, "completed");
  assert.equal(e.responses.length, 225);
  assert.equal(
    e.responses.filter((r) => r.evaluation.status === "done").length,
    225,
  );
  assert.equal(e.ratings.length, 675);
  assert.equal(e.diagnostics.length, 900);
  assert.equal(e.ranking.length, 100);
  assert.ok(
    e.ranking.every(
      (r) => Number.isFinite(r.score) && r.score >= 0 && r.score <= 100,
    ),
  );
  assert.ok(
    e.groups.every((gs) => new Set(gs.flatMap((g) => g.members)).size === 100),
  );
  const start = performance.now();
  recalculate(e);
  const elapsed = performance.now() - start;
  assert.ok(
    elapsed < 1500,
    `Ranking recalculation took ${elapsed.toFixed(1)}ms`,
  );
  console.log(
    `100-person simulation: 225 contributions, 675 competence ratings, 900 presentation ratings; recalculation ${elapsed.toFixed(1)}ms.`,
  );
});
