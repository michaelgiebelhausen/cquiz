# cquiz build roadmap

**Status:** 6/7 tasks complete
**Current Phase:** Hosted rehearsal

## Foundation

Goal: importable, persistent and protected exam service. References: PRD §§2–4, 9, 12.

- [x] **TASK-001** — Establish project, docs, import contract and persistent storage.
      Files: `package.json`, `server/store.mjs`, `server/imports.mjs`, `docs/import-format.md`
      Notes: Validate CSV/XLSX and synthetic fixtures; no protected real data in tests.
- [x] **TASK-002** — Implement ranking, historical peer recalculation and adaptive grouping.
      Files: `server/scoring.mjs`, `server/grouping.mjs`, `docs/scoring.md`, `tests/engine.test.mjs`
      Notes: Test bounded convergence, ties, 3–100 people, repeat avoidance, flag inclusion and diagnostic exclusion.

## Core exam

Goal: complete four-person and multi-table flow. References: PRD §§5–7, 11.

- [x] **TASK-003** — Build authoritative sessions, timing, rating gates and provider evaluation.
      Files: `server/index.mjs`, `server/engine.mjs`, `server/provider.mjs`, `tests/api.test.mjs`
      Notes: Test auth separation, persistence, retries, locking, idempotency and live fail-closed behavior.
- [x] **TASK-004** — Build mobile student experience and desktop instructor console.
      Files: `src/App.tsx`, `src/styles.css`, `src/speech.ts`, `src/api.ts`
      Notes: Apply agreed design tokens; exercise speech lifecycle, empty/error/loading states, keyboard and 320px layouts.

## Verification and handoff

Goal: build, review and run the complete exam. References: PRD §§7–14.

- [x] **TASK-005** — Verify browser flows, 100-person simulation, failure recovery and review.
      Files: `tests/browser.spec.ts`, `tests/exam.test.mjs`, `docs/verification.md`
      Notes: Run full suite, screenshot desktop/mobile, security review, fix findings. Live API/device checks distinguished from simulations.
- [x] **TASK-006** — Deliver runbook, setup, export evidence and ready-to-run packaging.
      Files: `README.md`, `scripts/setup.mjs`, `vercel.json`, `docs/hosting.md`, `docs/exam-runbook.md`
      Notes: Keep credentials private; PostgreSQL on Vercel or persistent local host; operator preflight lists real readiness requirements. No deployment unless separately approved.

## Agent Session Guide

Work in order, verify each increment, preserve failure evidence, and never label rehearsal scoring as real AI. Commit locally only after verified delivery. All UI values originate in docs/design.md.

## Hosted rehearsal

- [ ] **TASK-007** — Connect GitHub/Vercel/PostgreSQL, configure OpenRouter privately and verify actual phones and live grading on the classroom URL. Local software checks are complete; this account/device readiness step remains open.
