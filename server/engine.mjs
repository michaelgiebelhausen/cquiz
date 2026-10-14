import { randomUUID } from "node:crypto";
import { assert } from "./imports.mjs";
import { assignGroups } from "./grouping.mjs";
import { recalculate } from "./scoring.mjs";

export const defaultSettings = {
  roundSeconds: 900,
  transitionSeconds: 300,
  invitationSeconds: 12,
  rounds: 3,
  weights: { ai: 50, peer: 30, willingness: 20 },
};
export function validateSettings(settings) {
  for (const [k, min, max] of [
    ["roundSeconds", 30, 3600],
    ["transitionSeconds", 10, 900],
    ["invitationSeconds", 5, 60],
  ])
    assert(
      Number.isInteger(settings[k]) && settings[k] >= min && settings[k] <= max,
      `${k} is outside its allowed range.`,
    );
  const w = settings.weights;
  assert(
    w &&
      ["ai", "peer", "willingness"].every(
        (k) => Number.isFinite(w[k]) && w[k] >= 0 && w[k] <= 100,
      ) &&
      Math.abs(w.ai + w.peer + w.willingness - 100) < 0.0001,
    "Assessment weights must sum to 100.",
  );
  return { ...settings, rounds: 3 };
}
export function createExam(
  name,
  mode,
  bank,
  roster,
  settings = defaultSettings,
) {
  assert(
    bank.length >= 3,
    "Upload at least three questions before creating an exam.",
  );
  assert(roster.length >= 3, "Upload a roster before creating an exam.");
  assert(
    ["live", "rehearsal"].includes(mode),
    "Select live or rehearsal mode.",
  );
  const e = {
    id: randomUUID(),
    name,
    mode,
    status: "lobby",
    phase: "lobby",
    round: 0,
    deadline: null,
    paused: false,
    remaining: null,
    revision: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    settings: validateSettings(settings),
    bank: structuredClone(bank),
    roster: structuredClone(roster).map((s) => ({
      ...s,
      participantId: randomUUID(),
      joined: false,
      preflight: false,
      active: false,
    })),
    groups: [],
    tables: [],
    invitations: [],
    responses: [],
    ratings: [],
    diagnostics: [],
    seenQuestions: Object.create(null),
    ranking: [],
    rankingMeta: null,
  };
  recalculate(e);
  return e;
}
export function findTable(e, student) {
  return e.tables.find((t) => t.members.includes(student));
}
export function missingRatings(e, student) {
  return e.responses.filter(
    (r) =>
      r.studentId !== student &&
      r.rateable &&
      r.expectedRaters.includes(student) &&
      !e.ratings.some((p) => p.responseId === r.id && p.raterId === student),
  );
}
function eligible(e, t, online) {
  return t.members.filter(
    (id) =>
      e.roster.find((s) => s.id === id)?.preflight &&
      online.has(id) &&
      missingRatings(e, id).length === 0,
  );
}
function newInvitation(e, t, now, online) {
  const people = eligible(e, t, online);
  if (!people.length) {
    t.phase = "waiting";
    t.invitationId = null;
    return;
  }
  const i = {
    id: randomUUID(),
    tableId: t.id,
    questionId: t.questionId,
    round: e.round,
    openedAt: now,
    closesAt: now + e.settings.invitationSeconds * 1000,
    eligible: people,
    volunteers: [],
    closed: false,
    selected: null,
  };
  e.invitations.push(i);
  t.phase = "invitation";
  t.invitationId = i.id;
  t.speakerId = null;
}
function chooseQuestion(e, t, now, online) {
  const previous = new Set(
    t.members.flatMap((id) => e.seenQuestions[id] ?? []),
  );
  const q = e.bank.find((q) => !previous.has(q.id));
  if (!q) {
    t.phase = "exhausted";
    t.questionId = null;
    t.invitationId = null;
    t.speakerId = null;
    return;
  }
  t.questionId = q.id;
  t.credited = Object.create(null);
  t.extensionTexts = [];
  t.speakerId = null;
  for (const id of t.members) {
    e.seenQuestions[id] ??= [];
    e.seenQuestions[id].push(q.id);
  }
  newInvitation(e, t, now, online);
}
function startRound(e, now, online) {
  e.phase = "round";
  e.status = "running";
  e.deadline = now + e.settings.roundSeconds * 1000;
  e.tables = e.groups[e.round - 1].map((g) => ({
    ...g,
    phase: "waiting",
    questionId: null,
    speakerId: null,
    invitationId: null,
    credited: {},
    extensionTexts: [],
    currentResponseId: null,
  }));
  for (const t of e.tables) chooseQuestion(e, t, now, online);
}
export function startExam(e, now, online) {
  assert(e.status === "lobby", "This exam has already started.");
  const roster = e.roster.filter(
    (s) => s.joined && s.preflight && online.has(s.id),
  );
  assert(
    roster.length >= 3,
    "At least three connected students must pass their microphone checks.",
  );
  for (const s of e.roster) s.active = roster.some((r) => r.id === s.id);
  e.round = 1;
  e.groups = [assignGroups(roster, [], [], 1)];
  startRound(e, now, online);
  recalculate(e);
}
export function volunteer(e, id, now) {
  assert(
    e.phase === "round" && !e.paused,
    "The exam is not accepting contributions now.",
    409,
  );
  const t = findTable(e, id),
    i = e.invitations.find((i) => i.id === t?.invitationId);
  assert(
    t?.phase === "invitation" && i && !i.closed && now < i.closesAt,
    "This invitation has closed.",
    409,
  );
  assert(
    i.eligible.includes(id) && missingRatings(e, id).length === 0,
    "Complete your peer ratings before volunteering.",
    409,
  );
  if (!i.volunteers.includes(id)) i.volunteers.push(id);
  recalculate(e);
  return i;
}
export function prepareResponse(e, id, text, requestId, now) {
  const existing = e.responses.find(
    (r) => r.requestId === requestId && r.studentId === id,
  );
  if (existing) return existing;
  assert(
    e.phase === "round" && !e.paused,
    "This round is not accepting answers.",
    409,
  );
  const t = findTable(e, id);
  assert(
    t?.phase === "speaking" && t.speakerId === id,
    "It is not your turn.",
    409,
  );
  assert(
    typeof text === "string" && text.trim().length > 0 && text.length <= 8000,
    "Your contribution must contain 1–8,000 characters.",
  );
  const r = e.responses.find((r) => r.id === t.currentResponseId);
  assert(
    r?.evaluation.status === "recording",
    "This turn has already been submitted.",
    409,
  );
  Object.assign(r, {
    requestId,
    text: text.trim(),
    submittedAt: now,
    evaluation: { status: "pending", attempts: 0 },
  });
  t.phase = "rating";
  t.speakerId = null;
  t.invitationId = null;
  return r;
}
export function applyEvaluation(e, responseId, result, now) {
  const r = e.responses.find((r) => r.id === responseId);
  assert(r, "Response not found.", 404);
  if (r.evaluation.status === "done") return;
  const q = e.bank.find((q) => q.id === r.questionId);
  const previous = e.responses.filter(
    (p) =>
      p.id !== r.id &&
      p.tableId === r.tableId &&
      p.questionId === r.questionId &&
      p.evaluation.status === "done",
  );
  const credited = Object.create(null);
  for (const p of previous)
    for (const c of p.creditedInsights)
      credited[c.id] = (credited[c.id] ?? 0) + c.credit;
  const credits = result.insights.map((c) => {
    const insight = q.insights.find((i) => i.id === c.id);
    assert(insight, "AI returned an unknown insight ID.");
    const credit = Math.max(0, Math.min(c.credit, 1 - (credited[c.id] ?? 0)));
    return { ...c, credit, weight: insight.weight };
  });
  r.creditedInsights = credits;
  r.points = credits.reduce((sum, c) => sum + c.credit * c.weight, 0);
  r.evaluation = {
    ...result,
    status: "done",
    at: now,
    attempts: r.evaluation.attempts,
    model: e.providerSnapshot?.model ?? "rehearsal-only",
  };
  const t = e.tables.find((t) => t.id === r.tableId);
  if (t?.questionId === r.questionId) {
    for (const c of credits)
      t.credited[c.id] = (t.credited[c.id] ?? 0) + c.credit;
  }
  recalculate(e);
}
export function rate(e, rater, responseId, values, now) {
  assert(
    ["running", "completed"].includes(e.status) && !e.paused,
    "Ratings are unavailable right now.",
    409,
  );
  const r = e.responses.find((r) => r.id === responseId);
  assert(
    r && r.rateable && r.expectedRaters.includes(rater),
    "You cannot rate this contribution.",
    403,
  );
  assert(
    Array.isArray(values) &&
      values.length === 3 &&
      values.every((v) => Number.isInteger(v) && v >= 1 && v <= 5),
    "Choose one response for each of the three statements.",
  );
  const existing = e.ratings.find(
    (p) => p.responseId === responseId && p.raterId === rater,
  );
  if (existing) return existing;
  const standing = e.ranking.find((s) => s.id === rater);
  const rating = {
    id: randomUUID(),
    responseId,
    raterId: rater,
    targetId: r.studentId,
    values,
    createdAt: now,
    rankSnapshot: {
      rank: standing.rank,
      ai: standing.ai,
      peer: standing.peer,
      influence: standing.influence,
    },
    currentWeight: standing.influence,
  };
  e.ratings.push(rating);
  recalculate(e);
  return rating;
}
export function flagResponse(e, id, responseId, reason, now) {
  const r = e.responses.find((r) => r.id === responseId);
  assert(r && r.studentId === id, "You can flag only your own response.", 403);
  r.flagged = true;
  r.flagReason = reason?.slice(0, 250) || "Possible transcription error";
  r.flaggedAt = now;
}
export function diagnostic(e, rater, target, values, now, round = e.round) {
  assert(
    Number.isInteger(round) && round >= 1 && round <= e.round,
    "Invalid presentation-rating round.",
  );
  assert(
    round < e.round || e.phase === "transition" || e.status === "completed",
    "Presentation ratings open at the end of a round.",
    409,
  );
  const groups = e.groups[round - 1],
    group = groups.find((g) => g.members.includes(rater));
  assert(
    group && rater !== target && group.members.includes(target),
    "Rate a tablemate from the round that just ended.",
    403,
  );
  assert(
    Array.isArray(values) &&
      values.length === 2 &&
      values.every((v) => Number.isInteger(v) && v >= 1 && v <= 5),
    "Complete both presentation ratings.",
  );
  const old = e.diagnostics.find(
    (d) => d.round === round && d.raterId === rater && d.targetId === target,
  );
  if (old) return old;
  const d = {
    id: randomUUID(),
    round,
    raterId: rater,
    targetId: target,
    fluency: values[0],
    appearance: values[1],
    createdAt: now,
  };
  e.diagnostics.push(d);
  return d;
}
export function endRound(e, now) {
  assert(e.phase === "round", "No active round to end.", 409);
  for (const i of e.invitations)
    if (!i.closed) {
      i.closed = true;
      i.cancelled = true;
    }
  for (const t of e.tables) {
    const r = e.responses.find((r) => r.id === t.currentResponseId);
    if (r?.evaluation.status === "recording") {
      if (r.text.trim()) {
        r.submittedAt = now;
        r.autoSubmitted = true;
        r.evaluation = { status: "pending", attempts: 0 };
      } else {
        r.rateable = false;
        r.evaluation = { status: "cancelled", attempts: 0 };
      }
    }
    t.phase = "closed";
    t.speakerId = null;
  }
  if (e.round === 3) {
    e.status = "completed";
    e.phase = "completed";
    e.deadline = null;
    e.completedAt = now;
  } else {
    e.phase = "transition";
    e.deadline = now + e.settings.transitionSeconds * 1000;
    e.nextGroups = assignGroups(
      e.roster.filter((s) => s.active),
      e.ranking,
      e.groups,
      e.round + 1,
    );
  }
  recalculate(e);
}
export function nextRound(e, now, online) {
  assert(e.phase === "transition", "Not in a transition.", 409);
  e.round++;
  e.groups.push(e.nextGroups);
  delete e.nextGroups;
  startRound(e, now, online);
}
export function tick(e, now, online) {
  if (e.status !== "running" || e.paused) return false;
  let changed = false;
  if (now >= e.deadline) {
    const boundary = e.deadline;
    if (e.phase === "round") endRound(e, boundary);
    else nextRound(e, boundary, online);
    if (e.status === "running" && now >= e.deadline) tick(e, now, online);
    return true;
  }
  if (e.phase !== "round") return false;
  for (const t of e.tables) {
    if (t.phase === "invitation") {
      const i = e.invitations.find((i) => i.id === t.invitationId);
      if (now >= i.closesAt) {
        // Disconnected/obligated students are not counted as having declined.
        i.eligible = i.eligible.filter(
          (id) => online.has(id) && missingRatings(e, id).length === 0,
        );
        i.volunteers = i.volunteers.filter((id) => i.eligible.includes(id));
        i.closed = true;
        changed = true;
        if (i.volunteers.length) {
          const counts = (id) =>
            e.responses.filter((r) => r.studentId === id).length;
          const rank = (id) => e.ranking.find((r) => r.id === id)?.score ?? 0;
          i.volunteers.sort(
            (a, b) =>
              rank(a) - rank(b) || counts(a) - counts(b) || a.localeCompare(b),
          );
          t.speakerId = i.volunteers[0];
          i.selected = t.speakerId;
          t.phase = "speaking";
          const r = {
            id: randomUUID(),
            requestId: null,
            studentId: t.speakerId,
            tableId: t.id,
            round: e.round,
            questionId: t.questionId,
            text: "",
            submittedAt: null,
            flagged: false,
            flagReason: null,
            expectedRaters: t.members.filter((m) => m !== t.speakerId),
            rateable: true,
            evaluation: { status: "recording", attempts: 0 },
            points: 0,
            creditedInsights: [],
          };
          e.responses.push(r);
          t.currentResponseId = r.id;
        } else chooseQuestion(e, t, now, online);
      }
    } else if (t.phase === "waiting") {
      if (eligible(e, t, online).length) {
        newInvitation(e, t, now, online);
        changed = true;
      }
    } else if (t.phase === "rating") {
      const r = e.responses.find((r) => r.id === t.currentResponseId);
      if (
        r.evaluation.status === "done" &&
        r.expectedRaters.every(
          (id) =>
            !online.has(id) ||
            e.ratings.some((p) => p.responseId === r.id && p.raterId === id),
        )
      ) {
        const q = e.bank.find((q) => q.id === t.questionId),
          exhausted = q.insights.every((i) => (t.credited[i.id] ?? 0) >= 0.999);
        if (exhausted) chooseQuestion(e, t, now, online);
        else newInvitation(e, t, now, online);
        changed = true;
      }
    }
  }
  if (changed) recalculate(e);
  return changed;
}
export function pause(e, now) {
  assert(e.status === "running", "Only running exams can be paused.", 409);
  assert(!e.paused, "Already paused.", 409);
  e.paused = true;
  e.remaining = Math.max(0, e.deadline - now);
  for (const i of e.invitations)
    if (!i.closed) i.remaining = Math.max(0, i.closesAt - now);
}
export function resume(e, now) {
  assert(e.paused, "Exam is not paused.", 409);
  e.paused = false;
  e.deadline = now + e.remaining;
  for (const i of e.invitations)
    if (!i.closed)
      i.closesAt = now + (i.remaining ?? e.settings.invitationSeconds * 1000);
}
