# cquiz

<!-- impeccable:product-schema 1 -->

## Platform

Web. Mobile browser for students; desktop browser for the instructor. In-person classroom now; individual clients and table sessions can support later virtual adaptations.

## Stack

User delegated implementation choices. React, TypeScript and Vite; Express on Node 24; PostgreSQL on Vercel, persistent SQLite for local rehearsals. OpenRouter for AI evaluation. Browser speech recognition; cquiz never captures or stores audio.

## Users and purpose

Michael Giebelhausen and instructors run an actual automatically assessed oral-style exam for up to 100 students. Students volunteer, contribute one insight through speech-to-text, and privately assess competence. Relative ranking is primary; weighted insight points and component scores remain available.

## Confirmed rules

Three 15-minute rounds, two five-minute transitions. Random first groups, adaptive later groups, sizes three to five. Weights default 50/30/20, locked after start. Historical peer ratings reweight using current AI and peer standing. Transcript flags do not exclude assessment. No typed editing, speech target, recorded audio, generated questions, public rankings, conferencing, official grade updates, or appearance-based grading. Roster matches school email and student ID; an identity claim is not identity verification.

## Brand commitments

Confirmed white surfaces, deep blue text, orange active turn controls, compact instructor console. One primary student task at a time. Plain language, no game-show spectacle that interferes with assessment.

## Success

A complete synthetic multi-table exam survives restart, assigns new groups, collects and assesses contributions, enforces rating gates, recalculates ranking, and exports an auditable result. Live readiness additionally requires configured OpenRouter credentials, a successful model probe, HTTPS for phone access, and device microphone checks. No live readiness claim from mock results.
