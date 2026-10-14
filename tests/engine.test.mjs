import test from "node:test";
import assert from "node:assert/strict";
import { bank, roster, evaluation } from "./fixtures.mjs";
import { groupSizes, assignGroups } from "../server/grouping.mjs";
import { recalculate } from "../server/scoring.mjs";
import * as E from "../server/engine.mjs";
function exam(n = 4) {
  const e = E.createExam("Test exam", "rehearsal", bank(), roster(n), {
    ...E.defaultSettings,
    roundSeconds: 30,
    transitionSeconds: 10,
    invitationSeconds: 5,
  });
  e.roster.forEach((s) => {
    s.joined = true;
    s.preflight = true;
  });
  return e;
}
function turn(e, ids, now = 0) {
  const online = new Set(e.roster.map((s) => s.id));
  if (e.status === "lobby") E.startExam(e, now, online);
  ids.forEach((id) => E.volunteer(e, id, now + 1));
  E.tick(e, now + 5001, online);
  const t = E.findTable(e, ids[0]);
  return { online, t, speaker: t.speakerId };
}
test("every attendance count 3–100 forms valid complete groups", () => {
  for (let n = 3; n <= 100; n++) {
    const sizes = groupSizes(n);
    assert.equal(
      sizes.reduce((a, b) => a + b),
      n,
    );
    assert.ok(sizes.every((s) => s >= 3 && s <= 5));
    const groups = assignGroups(roster(n));
    assert.equal(new Set(groups.flatMap((g) => g.members)).size, n);
  }
});
test("adaptive groups reduce repeat encounters and retain every participant", () => {
  const people = roster(32),
    one = assignGroups(people, [], [], 1, () => 0.3),
    rank = people.map((s, i) => ({ id: s.id, score: i * 3, uncertainty: 0.5 })),
    two = assignGroups(people, rank, [one], 2, () => 0.4);
  const repeats = two.reduce(
    (n, g) =>
      n +
      g.members.reduce(
        (s, a, i) =>
          s +
          g.members
            .slice(i + 1)
            .filter((b) =>
              one.some((o) => o.members.includes(a) && o.members.includes(b)),
            ).length,
        0,
      ),
    0,
  );
  assert.ok(repeats < 4, `Unexpected repeat count ${repeats}`);
  assert.equal(new Set(two.flatMap((g) => g.members)).size, 32);
});
test("volunteering is idempotent, tie selection rotates by prior contribution count", () => {
  const e = exam();
  const { t, speaker } = turn(e, ["001", "002"]);
  assert.equal(speaker, "001");
  assert.equal(e.invitations[0].volunteers.length, 2);
  assert.throws(() => E.volunteer(e, "003", 6000), /closed/);
  assert.equal(t.phase, "speaking");
});
test("peer ratings can be collected during speaking and gate next contribution", () => {
  const e = exam();
  const { t, speaker } = turn(e, ["001", "002"]);
  const r = e.responses.find((r) => r.id === t.currentResponseId);
  assert.equal(r.evaluation.status, "recording");
  E.rate(e, "002", r.id, [4, 4, 4], 6000);
  assert.equal(E.missingRatings(e, "002").length, 0);
  assert.equal(E.missingRatings(e, "003").length, 1);
  assert.throws(() => E.rate(e, speaker, r.id, [5, 5, 5], 6001), /cannot rate/);
});
test("multiple insights earn credit; duplicate insight and submit do not", () => {
  const e = exam();
  const { speaker, t } = turn(e, ["001"]);
  const r = E.prepareResponse(
    e,
    speaker,
    "Goals, context, and evidence.",
    "request-one",
    6000,
  );
  E.applyEvaluation(e, r.id, evaluation(["a", "b"]), 7000);
  assert.equal(r.points, 3);
  assert.equal(
    E.prepareResponse(e, speaker, "Changed text", "request-one", 7001).id,
    r.id,
  );
  assert.equal(r.text, "Goals, context, and evidence.");
  for (const id of r.expectedRaters) E.rate(e, id, r.id, [4, 4, 4], 7100);
  E.tick(e, 7500, new Set(e.roster.map((s) => s.id)));
  E.volunteer(e, "002", 7501);
  E.tick(e, 12501, new Set(e.roster.map((s) => s.id)));
  const r2 = E.prepareResponse(e, "002", "More goals.", "request-two", 13000);
  E.applyEvaluation(e, r2.id, evaluation(["a"]), 14000);
  assert.equal(r2.points, 0);
});
test("transcription flags retain AI and peer evidence; diagnostics never affect ranking", () => {
  const e = exam();
  const { speaker, t } = turn(e, ["001"]);
  const r = E.prepareResponse(e, speaker, "Clear goals.", "request-one", 6000);
  E.applyEvaluation(e, r.id, evaluation(), 7000);
  E.rate(e, "002", r.id, [4, 5, 4], 7001);
  const before = e.ranking.map((r) => r.score);
  E.flagResponse(e, speaker, r.id, "Incorrect transcription", 7002);
  recalculate(e);
  assert.deepEqual(
    e.ranking.map((r) => r.score),
    before,
  );
  E.endRound(e, 8000);
  const before2 = e.ranking.map((r) => r.score);
  E.diagnostic(e, "002", "001", [1, 1], 8001);
  recalculate(e);
  assert.deepEqual(
    e.ranking.map((r) => r.score),
    before2,
  );
});
test("historical peer weights change with current rater mastery", () => {
  const e = exam();
  const { speaker, t } = turn(e, ["001"]);
  const r = E.prepareResponse(e, speaker, "Goals.", "request-one", 6000);
  E.applyEvaluation(e, r.id, evaluation(), 7000);
  E.rate(e, "002", r.id, [5, 5, 5], 7001);
  E.rate(e, "003", r.id, [1, 1, 1], 7002);
  const initial = e.ratings[0].currentWeight;
  e.responses.push({
    ...structuredClone(r),
    id: "another",
    studentId: "002",
    questionId: "q2",
    points: 5,
    creditedInsights: [],
    evaluation: { status: "done", correctness: 1, depth: 1 },
  });
  recalculate(e);
  assert.notEqual(e.ratings[0].currentWeight, initial);
  assert.ok(e.ranking.every((r) => r.influence >= 0.5 && r.influence <= 1.5));
  assert.equal(e.ratings[0].rankSnapshot.influence, 1);
});
test("pause preserves timing; transitions and all three rounds complete", () => {
  const e = exam(7),
    online = new Set(e.roster.map((s) => s.id));
  E.startExam(e, 0, online);
  E.pause(e, 1000);
  E.tick(e, 90000, online);
  assert.equal(e.phase, "round");
  E.resume(e, 91000);
  assert.equal(e.deadline, 120000);
  E.tick(e, 120001, online);
  assert.equal(e.phase, "transition");
  assert.equal(e.nextGroups.flatMap((g) => g.members).length, 7);
  E.tick(e, 130002, online);
  assert.equal(e.round, 2);
  E.endRound(e, 140000);
  E.nextRound(e, 150000, online);
  E.endRound(e, 160000);
  assert.equal(e.status, "completed");
  assert.equal(e.groups.length, 3);
});
test("round end auto-submits collected text without audio or data loss", () => {
  const e = exam();
  const { t } = turn(e, ["001"]);
  const r = e.responses.find((r) => r.id === t.currentResponseId);
  r.text = "A captured unfinished contribution.";
  E.endRound(e, 9000);
  assert.equal(r.evaluation.status, "pending");
  assert.equal(r.text, "A captured unfinished contribution.");
  assert.equal(r.autoSubmitted, true);
});
test("disconnects are excluded from invitation counts; rating obligations block volunteering", () => {
  const e = exam(),
    online = new Set(e.roster.map((s) => s.id));
  E.startExam(e, 0, online);
  E.volunteer(e, "001", 1);
  online.delete("003");
  E.tick(e, 5001, online);
  assert.ok(!e.invitations[0].eligible.includes("003"));
});
test("bank exhaustion never silently repeats known questions", () => {
  const e = exam(),
    online = new Set(e.roster.map((s) => s.id));
  e.seenQuestions = Object.fromEntries(
    e.roster.map((s) => [s.id, e.bank.map((q) => q.id)]),
  );
  E.startExam(e, 0, online);
  assert.equal(e.tables[0].phase, "exhausted");
});
