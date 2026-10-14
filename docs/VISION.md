# Vision — cquiz

**Created:** 2026-10-14
**Updated:** 2026-10-14

## Founder

- **Name:** Michael Giebelhausen
- **Expertise:** University teaching, marketing, and AI tools and techniques.
- **Background:** Wants conversational assessment of applied AI knowledge rather than rehearsed hype.

## Purpose

- **Who you help:** Instructors and university students.
- **Problem you solve:** Oral exams are difficult to scale and conventional quizzes miss conversational mastery.
- **Desired transformation:** A class can demonstrate knowledge in simultaneous table conversations with a retained assessment record.
- **Why you:** Instructor who developed the conversational question and adaptive mingling concept.

## Product

- **Name:** cquiz
- **One-liner:** An adaptive conversational exam with individual voice-to-text contributions and automated ranking.
- **How it works:** Import a roster and weighted question bank, join on phones, volunteer, contribute, rate, mingle twice, inspect rankings and export.
- **Key capabilities:**
  - Live table and speaking-turn coordination.
  - Rubric-based AI assessment and retained insight points.
  - Retrospective weighted peer assessment and willingness signals.
  - Adaptive regrouping and persistent exam recovery.
  - Validated spreadsheet imports and instructor readiness checks.
- **Platform:** web
- **Market differentiation:** Ranking informed by observed mastery, willingness, and dynamically weighted peer competence.
- **Magic moment:** New evidence updates standings and changes the next grouping while every student stays in a simple conversation flow.

## Audience

- **Primary user:** Instructor administering an in-person exam to a class in the low thirties, capacity 100.
- **Secondary users:**
  - Students using their individual phones at tables of three to five.
  - Instructor reviewing evidence and diagnostic presentation ratings after an exam.
- **Current alternatives:** Conventional short-answer exams and instructor-led oral examinations.
- **Frustrations:** Sequential oral exams do not scale; answer fluency and appearance may influence perceived competence.

## Business

- **Revenue model:** free
- **90-day goal:** Suggested: run one verified classroom exam with usable ranking evidence.
- **6-month vision:** Suggested: refine assessment from observed classroom results before extending delivery modes.
- **Constraints:** No official grade integration, no retained audio, no in-app content generation, 100 participants, external API credentials supplied privately.
- **Go-to-market:** Internal instructor use, not a public launch.

## Brand Voice

- **Personality:** Focused, conversational, calm.
- **Tone of voice:** Direct task cues: “Your key insight”, “I have something to add”, “Move to table 4”.

## Tech Stack

- **App type:** web
- **Frontend:** React and TypeScript — delegated choice, responsive role-specific screens.
- **Backend:** Express on Node 24 — delegated choice, authoritative timing and persistent event handling.
- **Database:** SQLite — delegated choice, one process and durable local disk, transactional commits.
- **Auth:** Instructor password and HttpOnly sessions; student roster pair and participant session — matches user-selected entry flow.
- **Payments:** None — internal teaching tool.
- **Analytics:** None — protected exam events stay in the app.
- **Email:** None — no outgoing messages or verification codes.
- **Error tracking:** Local sanitized errors — no third-party student-data logging.

## Tooling

- **Coding agent:** other: Codex
