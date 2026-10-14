# cquiz

A conversational classroom exam: students contribute one spoken insight from their phones, rate tablemates privately, and change tables between three adaptive rounds. Instructors see current rankings, retained points, grading evidence and exports.

## Run locally

Requires Node.js 24 and npm. Run `npm ci`, `npm run setup`, `npm run build`, then `npm start`. Open http://localhost:4318/admin. The generated instructor password is in the private `.env` file. Local SQLite data lives in `data/`; keep that folder and its `server.key` together when backing up. A laptop's localhost address is accessible only on that laptop; phone speech requires a hosted HTTPS address.

Use **Load rehearsal kit** in the instructor workspace to try the complete exam with fictional students. Rehearsal grading is explicitly synthetic. Live exams require a successfully tested OpenRouter configuration and imported course content.

## Host on Vercel

This repository includes Vercel configuration for the React frontend and same-origin API. Hosted exams require PostgreSQL; SQLite is used only for a local persistent server. See [hosting setup](docs/hosting.md). No secrets, exam data, real student roster, or screenshots are included in Git.

## Instructor workflow

1. Upload your roster and weighted insight bank using the CSV/Excel templates in the app. The app supplies a reusable prompt for your own AI to create the bank; it does not generate exam content.
2. Configure the OpenRouter model and key privately in the instructor workspace, then run the connection test. Set weights and timing before creating the exam.
3. Create a lobby, share its student link, verify attendance and require each phone to pass the speech preflight.
4. Run three rounds, monitor tables and grading, and let the app assign the next groups. Default duration is 55 minutes including two mingles.
5. Resolve failed grading jobs and outstanding ratings before interpreting rankings. Download both scores and evidence; unresolved results are labeled provisional.

See the [exam runbook](docs/exam-runbook.md), [import contract](docs/import-format.md), [scoring specification](docs/scoring.md), and [verification record](docs/verification.md).

## Checks

`npm run build` compiles the production frontend. `npm test` exercises scoring, grouping, imports, protected sessions, persistence, provider failures and hosted PostgreSQL behavior. `npm run test:browser` rehearses a complete four-phone exam using simulated browser speech. Real phones, live OpenRouter grading, and the hosted database must still pass an operator rehearsal before a graded class exam.

Browser speech support varies. cquiz stores text only; the browser's speech provider may process audio. The app does not capture, upload or retain audio files. Email plus student ID is a roster identity claim, so the instructor must verify physical attendance. Rankings are experimental assessment estimates, not a validated psychometric model or official grade submission.
