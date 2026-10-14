import ExcelJS from "exceljs";
import Papa from "papaparse";

export const BANK_HEADERS = [
  "question_id",
  "topic",
  "prompt",
  "insight_id",
  "ideal_insight",
  "weight",
  "grading_guidance",
  "source_reference",
  "difficulty",
];
export const ROSTER_HEADERS = ["school_email", "student_id", "display_name"];
export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function assert(condition, message, status = 400) {
  if (!condition) throw new AppError(message, status);
}
const str = (v) => String(v ?? "").trim();
// Inspect ZIP directory before ExcelJS inflates it. Reject oversized/ZIP64 archives.
function checkWorkbook(buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--)
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  assert(end >= 0, "This is not a valid XLSX workbook.");
  const count = buffer.readUInt16LE(end + 10),
    start = buffer.readUInt32LE(end + 16);
  assert(
    count < 1000 && start < buffer.length,
    "Workbook archive is too complex.",
  );
  let at = start,
    total = 0;
  for (let i = 0; i < count; i++) {
    assert(
      at + 46 <= buffer.length && buffer.readUInt32LE(at) === 0x02014b50,
      "Invalid workbook archive directory.",
    );
    const size = buffer.readUInt32LE(at + 24);
    total += size;
    assert(
      size !== 0xffffffff && total < 16 * 1024 * 1024,
      "Workbook expands beyond the 16 MB limit. Use CSV instead.",
    );
    at +=
      46 +
      buffer.readUInt16LE(at + 28) +
      buffer.readUInt16LE(at + 30) +
      buffer.readUInt16LE(at + 32);
  }
}
export async function parseUpload(buffer, name) {
  assert(buffer.length <= 2 * 1024 * 1024, "Upload must be smaller than 2 MB.");
  let rows;
  if (/\.csv$/i.test(name)) {
    const parsed = Papa.parse(buffer.toString("utf8").replace(/^\uFEFF/, ""), {
      skipEmptyLines: "greedy",
    });
    assert(
      !parsed.errors.length,
      "CSV could not be read. Check quoting and column counts.",
    );
    rows = parsed.data;
  } else if (/\.xlsx$/i.test(name)) {
    checkWorkbook(buffer);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    assert(
      wb.worksheets.length === 1,
      "Use one worksheet per upload. Upload bank and roster separately.",
    );
    rows = [];
    wb.worksheets[0].eachRow((row) => {
      assert(rows.length < 3002, "Maximum 3,000 data rows.");
      rows.push(
        row.values.slice(1).map((v) => {
          assert(
            typeof v !== "object" || v === null,
            "Use plain text and numbers, not formulas, links or rich text.",
          );
          return v;
        }),
      );
    });
  } else throw new AppError("Upload a CSV or XLSX file.");
  assert(
    rows.length >= 2 && rows.length <= 3001,
    "Include headers and between 1 and 3,000 data rows.",
  );
  const headers = rows[0].map((v) => str(v).toLowerCase());
  assert(
    new Set(headers).size === headers.length && headers.every(Boolean),
    "Headers must be unique and nonempty.",
  );
  return rows.slice(1).map((values, i) => {
    assert(values.length <= headers.length, `Row ${i + 2}: too many columns.`);
    return Object.fromEntries(headers.map((h, j) => [h, str(values[j])]));
  });
}
function required(rows, headers) {
  for (const h of headers)
    assert(
      Object.hasOwn(rows[0], h),
      `Missing column: ${h}. Download the template.`,
    );
}
export function validateBank(rows) {
  required(
    rows,
    BANK_HEADERS.filter((h) => h !== "difficulty"),
  );
  const questions = new Map();
  rows.forEach((r, index) => {
    const row = index + 2;
    for (const h of BANK_HEADERS.filter((h) => h !== "difficulty"))
      assert(
        r[h] && r[h].length <= 4000,
        `Row ${row}: ${h} is required and must be at most 4,000 characters.`,
      );
    assert(
      /^[\w.-]{1,80}$/.test(r.question_id) &&
        /^[\w.-]{1,80}$/.test(r.insight_id),
      `Row ${row}: IDs may use letters, numbers, dots, underscores and hyphens.`,
    );
    const weight = Number(r.weight),
      difficulty = Number(r.difficulty || 3);
    assert(
      Number.isFinite(weight) && weight > 0 && weight <= 10,
      `Row ${row}: weight must be greater than zero and at most 10.`,
    );
    assert(
      Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 5,
      `Row ${row}: difficulty must be 1–5.`,
    );
    let q = questions.get(r.question_id);
    if (!q) {
      q = {
        id: r.question_id,
        topic: r.topic,
        prompt: r.prompt,
        difficulty,
        insights: [],
      };
      questions.set(q.id, q);
    }
    assert(
      q.topic === r.topic &&
        q.prompt === r.prompt &&
        q.difficulty === difficulty,
      `Row ${row}: repeated question information must match.`,
    );
    assert(
      !q.insights.some((i) => i.id === r.insight_id),
      `Row ${row}: duplicate insight ID in this question.`,
    );
    q.insights.push({
      id: r.insight_id,
      text: r.ideal_insight,
      weight,
      guidance: r.grading_guidance,
      source: r.source_reference,
    });
    assert(
      q.insights.length <= 20,
      `Row ${row}: maximum 20 insights per question.`,
    );
  });
  assert(questions.size <= 600, "Maximum 600 questions.");
  return [...questions.values()];
}
export function validateRoster(rows) {
  required(rows, ROSTER_HEADERS);
  assert(
    rows.length >= 3 && rows.length <= 100,
    "Roster must contain 3–100 students.",
  );
  const emails = new Set(),
    ids = new Set();
  return rows.map((r, i) => {
    const email = r.school_email.toLowerCase(),
      id = r.student_id;
    assert(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254,
      `Row ${i + 2}: valid school_email required.`,
    );
    assert(
      /^[a-zA-Z0-9_-]{1,40}$/.test(id),
      `Row ${i + 2}: student_id must be text, 1–40 letters or digits.`,
    );
    assert(
      r.display_name && r.display_name.length <= 80,
      `Row ${i + 2}: display_name required, at most 80 characters.`,
    );
    assert(
      !emails.has(email) && !ids.has(id),
      `Row ${i + 2}: duplicate email or student ID.`,
    );
    emails.add(email);
    ids.add(id);
    return { id, email, name: r.display_name };
  });
}
export const toCSV = (rows) =>
  Papa.unparse(
    rows.map((row) =>
      Array.isArray(row)
        ? row.map(safeCell)
        : Object.fromEntries(
            Object.entries(row).map(([k, v]) => [k, safeCell(v)]),
          ),
    ),
  );
function safeCell(v) {
  return typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}
export async function template(kind, format = "csv") {
  const bank = [
    BANK_HEADERS,
    [
      "prompt-01",
      "Your course topic",
      "Give your top insider tip about this topic.",
      "insight-01",
      "Replace with a concise source-grounded insight.",
      2,
      "Accept valid paraphrases; describe common errors.",
      "Lecture file, page 4",
      3,
    ],
  ];
  const roster = [
    ROSTER_HEADERS,
    ["student01@example.edu", "001", "Student 01"],
    ["student02@example.edu", "002", "Student 02"],
    ["student03@example.edu", "003", "Student 03"],
    ["student04@example.edu", "004", "Student 04"],
  ];
  const rows = kind === "bank" ? bank : roster;
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(kind);
    rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => {
      c.width = 28;
    });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
  return Buffer.from(toCSV(rows));
}
