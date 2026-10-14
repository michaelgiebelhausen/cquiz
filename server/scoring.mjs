const mean = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x));
function percentile(values, id) {
  if (values.length < 2) return 0.5;
  const v = values.find((r) => r.id === id).score;
  const less = values.filter((r) => r.score < v - 1e-7).length,
    equal = values.filter((r) => Math.abs(r.score - v) < 1e-7).length;
  return (less + (equal - 1) / 2) / (values.length - 1);
}
export function recalculate(exam) {
  const students =
      exam.status === "lobby"
        ? exam.roster
        : exam.roster.filter((s) => s.active),
    bank = new Map(exam.bank.map((q) => [q.id, q]));
  const rateable = new Set(
    exam.responses.filter((r) => r.rateable).map((r) => r.id),
  );
  const ratingsByTarget = new Map();
  for (const p of exam.ratings)
    if (rateable.has(p.responseId)) {
      const list = ratingsByTarget.get(p.targetId) || [];
      list.push(p);
      ratingsByTarget.set(p.targetId, list);
    }
  const rows = students.map((s) => {
    const responses = exam.responses.filter(
      (r) => r.studentId === s.id && r.evaluation?.status === "done",
    );
    const topics = new Set(
      responses
        .filter((r) => r.points > 0 && r.evaluation.correctness > 0.25)
        .map((r) => bank.get(r.questionId)?.topic),
    );
    const correctness = mean(
        responses.map((r) => (r.points > 0 ? r.evaluation.correctness : 0)),
      ),
      depth = mean(
        responses.map((r) => (r.points > 0 ? r.evaluation.depth : 0)),
      );
    const breadth = Math.min(
      1,
      topics.size / Math.min(3, new Set(exam.bank.map((q) => q.topic)).size),
    );
    const ai = responses.length
      ? 100 * (0.7 * correctness + 0.2 * depth + 0.1 * breadth)
      : 0;
    const invitations = exam.invitations.filter(
      (i) => !i.cancelled && i.eligible.includes(s.id),
    );
    const volunteered = invitations.filter((i) =>
      i.volunteers.includes(s.id),
    ).length;
    return {
      id: s.id,
      name: s.name,
      points: responses.reduce((sum, r) => sum + (r.points ?? 0), 0),
      ai: clamp(ai),
      peer: 50,
      willingness: invitations.length
        ? (100 * volunteered) / invitations.length
        : 0,
      eligible: invitations.length,
      volunteered,
      answers: responses.length,
      topics: topics.size,
      peerCount: 0,
      influence: 1,
      flags: exam.responses.filter((r) => r.studentId === s.id && r.flagged)
        .length,
    };
  });
  let converged = false,
    iterations = 0;
  // AI anchors 50% of reputation. Bounded influence and damping prevent runaway iteration.
  for (let iteration = 0; iteration < 40; iteration++) {
    iterations = iteration + 1;
    const aiValues = rows.map((r) => ({ id: r.id, score: r.ai })),
      peerValues = rows.map((r) => ({ id: r.id, score: r.peer }));
    const weights = new Map(
      rows.map((r) => [
        r.id,
        r.answers || r.peerCount
          ? 0.5 +
            0.5 * (percentile(aiValues, r.id) + percentile(peerValues, r.id))
          : 1,
      ]),
    );
    let change = 0;
    for (const r of rows) {
      const ratings = ratingsByTarget.get(r.id) || [];
      const sum = ratings.reduce((s, p) => s + weights.get(p.raterId), 0);
      const next = sum
        ? ratings.reduce(
            (s, p) =>
              s + ((mean(p.values) - 1) / 4) * 100 * weights.get(p.raterId),
            0,
          ) / sum
        : 50;
      const updated = 0.5 * r.peer + 0.5 * next;
      change = Math.max(change, Math.abs(updated - r.peer));
      r.peer = updated;
      r.peerCount = ratings.length;
      r.influence = weights.get(r.id);
    }
    if (change < 0.001) {
      converged = true;
      break;
    }
  }
  const w = exam.settings.weights;
  for (const r of rows) {
    r.score =
      (w.ai * r.ai + w.peer * r.peer + w.willingness * r.willingness) / 100;
    r.evidence =
      r.answers >= 3 && r.topics >= 2 && r.peerCount >= 3
        ? "Established"
        : r.answers
          ? "Developing"
          : "Limited";
    r.uncertainty = 1 / Math.sqrt(1 + r.answers + r.peerCount / 3);
  }
  rows.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  let rank = 1;
  rows.forEach((r, index) => {
    if (index && Math.abs(rows[index - 1].score - r.score) > 0.00001)
      rank = index + 1;
    r.rank = rank;
  });
  for (const rating of exam.ratings)
    rating.currentWeight =
      rows.find((r) => r.id === rating.raterId)?.influence ?? 1;
  exam.ranking = rows;
  exam.rankingMeta = {
    converged,
    iterations,
    at: Date.now(),
    method: "cquiz-anchored-v1",
  };
  return rows;
}
export function snapshot(exam) {
  return {
    ranking: exam.ranking.map((r) => ({
      id: r.id,
      rank: r.rank,
      score: r.score,
      ai: r.ai,
      peer: r.peer,
      influence: r.influence,
    })),
    meta: exam.rankingMeta,
  };
}
