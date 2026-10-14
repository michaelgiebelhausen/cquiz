import { randomInt } from "node:crypto";
import { assert } from "./imports.mjs";
export function groupSizes(n) {
  assert(n >= 3 && n <= 100, "Exam requires 3–100 active students.");
  const sizes = Array(Math.floor(n / 4)).fill(4),
    remainder = n % 4;
  if (remainder === 1) {
    sizes[sizes.length - 1] = 5;
  }
  if (remainder === 2) {
    sizes[sizes.length - 1] = 3;
    sizes.push(3);
  }
  if (remainder === 3) sizes.push(3);
  return sizes;
}
function shuffle(values, rng) {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function assignGroups(
  roster,
  rankings = [],
  history = [],
  round = 1,
  rng = () => randomInt(1000000) / 1000000,
) {
  const sizes = groupSizes(roster.length),
    scores = new Map(rankings.map((r) => [r.id, r]));
  const seen = new Map();
  for (const groups of history)
    for (const g of groups)
      for (const a of g.members)
        for (const b of g.members)
          if (a !== b) seen.set(`${a}:${b}`, (seen.get(`${a}:${b}`) || 0) + 1);
  let pool = shuffle(
    roster.map((s) => s.id),
    rng,
  );
  if (round > 1)
    pool.sort(
      (a, b) =>
        (scores.get(b)?.uncertainty ?? 1) - (scores.get(a)?.uncertainty ?? 1),
    );
  const groups = sizes.map((size, index) => ({
    id: `r${round}-t${index + 1}`,
    number: index + 1,
    round,
    size,
    members: [],
    reason:
      round === 1
        ? "Random initial assignment"
        : "Resolve mastery uncertainty; reduce repeat peers; preserve a cross-level anchor",
  }));
  for (const g of groups) {
    g.members.push(pool.shift());
    while (g.members.length < g.size) {
      let best = 0,
        bestCost = Infinity;
      for (let i = 0; i < pool.length; i++) {
        const id = pool[i],
          repeats = g.members.reduce(
            (n, m) => n + (seen.get(`${id}:${m}`) || 0),
            0,
          );
        const candidate = scores.get(id)?.score ?? 50,
          lead = scores.get(g.members[0])?.score ?? 50;
        const last = g.members.length === g.size - 1;
        const distance = Math.abs(candidate - lead);
        const cost =
          round === 1
            ? rng()
            : repeats * 1000 +
              (last ? -distance * 0.35 : distance) -
              (scores.get(id)?.uncertainty ?? 1) * 8 +
              rng();
        if (cost < bestCost) {
          best = i;
          bestCost = cost;
        }
      }
      g.members.push(pool.splice(best, 1)[0]);
    }
  }
  // Local swaps reduce repeats across all groups without changing group sizes.
  if (round > 1) {
    const repeatCost = (g) =>
      g.members.reduce(
        (n, a, i) =>
          n +
          g.members
            .slice(i + 1)
            .reduce((s, b) => s + (seen.get(`${a}:${b}`) || 0), 0),
        0,
      );
    for (let pass = 0; pass < 3; pass++)
      for (let a = 0; a < groups.length; a++)
        for (let b = a + 1; b < groups.length; b++) {
          const ga = groups[a],
            gb = groups[b];
          let current = repeatCost(ga) + repeatCost(gb);
          for (let i = 0; i < ga.members.length; i++)
            for (let j = 0; j < gb.members.length; j++) {
              [ga.members[i], gb.members[j]] = [gb.members[j], ga.members[i]];
              const next = repeatCost(ga) + repeatCost(gb);
              if (next < current) current = next;
              else
                [ga.members[i], gb.members[j]] = [gb.members[j], ga.members[i]];
            }
        }
  }
  return groups;
}
