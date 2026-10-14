import test from "node:test";
import assert from "node:assert/strict";
import {
  parseUpload,
  validateBank,
  validateRoster,
  template,
  toCSV,
} from "../server/imports.mjs";
import { validateEvaluation } from "../server/provider.mjs";
import { bank, evaluation } from "./fixtures.mjs";
test("CSV and Excel templates parse and validate with leading zeros", async () => {
  for (const format of ["csv", "xlsx"]) {
    const rows = await parseUpload(
      await template("roster", format),
      `roster.${format}`,
    );
    const roster = validateRoster(rows);
    assert.equal(roster[0].id, "001");
    const qs = validateBank(
      await parseUpload(await template("bank", format), `bank.${format}`),
    );
    assert.equal(qs.length, 1);
    assert.equal(qs[0].insights[0].weight, 2);
  }
});
test("bank rejects invalid weights, conflicts, duplicate insights and missing columns", async () => {
  const rows = await parseUpload(await template("bank"), "bank.csv");
  assert.throws(() => validateBank([{ ...rows[0], weight: "0" }]), /weight/);
  assert.throws(() => validateBank([rows[0], { ...rows[0] }]), /duplicate/);
  assert.throws(
    () =>
      validateBank([
        rows[0],
        { ...rows[0], insight_id: "another", prompt: "Different" },
      ]),
    /must match/,
  );
  assert.throws(() => validateBank([{ question_id: "q" }]), /Missing column/);
});
test("roster rejects duplicates and exports neutralize spreadsheet formulas", async () => {
  const rows = await parseUpload(await template("roster"), "roster.csv");
  assert.throws(() => validateRoster([rows[0], rows[0], rows[2]]), /duplicate/);
  assert.ok(toCSV([{ name: '=HYPERLINK("evil")' }]).includes("'="));
});
test("evaluation rejects unknown IDs, inflated scores and injected fields", () => {
  assert.equal(validateEvaluation(evaluation(), bank()[0]).correctness, 1);
  assert.throws(
    () => validateEvaluation({ ...evaluation(), correctness: 10 }, bank()[0]),
    /invalid/,
  );
  assert.throws(
    () => validateEvaluation(evaluation(["unknown"]), bank()[0]),
    /unknown/,
  );
  assert.throws(
    () => validateEvaluation({ ...evaluation(), newRole: "admin" }, bank()[0]),
    /invalid/,
  );
});
