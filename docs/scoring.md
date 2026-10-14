# Assessment protocol: cquiz-anchored-v1

This is a deterministic, auditable implementation of the agreed experimental exam format. It is not a validated psychometric instrument or an item-response-theory model. Ranking is primary, weighted insight points are preserved, and evidence coverage remains visible. Settings and uploaded rubric are frozen per exam.

## AI mastery and points

The provider returns correctness and depth in [0,1], matched rubric insight IDs with partial credit in [0,1], and evidence-based rationale. The server validates the entire result and rejects unknown/duplicate IDs, out-of-range values, refusals, malformed JSON and incomplete responses. Student text is untrusted data, not model instructions. Names, emails and student IDs are not sent to the provider.

Each insight can receive a total of at most 1 credit per table/question. Earned points are new credit × instructor insight weight. Several new insights in one contribution all receive credit. Repetition gets no new credit. Meaningful extensions and valid paraphrases can match the instructor's broad insight guidance; graders cannot invent new weighted rubric items. A response flagged for transcription concerns remains fully included.

AI mastery is 100 × (0.70 × mean correctness + 0.20 × mean depth + 0.10 × topic breadth). A response earning no new insight credit contributes zero correctness/depth to prevent repeated answers from creating mastery credit. Topic breadth is correctly evidenced distinct topics divided by min(3, bank topic count), capped at 1. Lack of submitted evidence yields AI mastery 0 with a “Limited” evidence label; it is not a claim that every unseen answer was incorrect. Points, answers, topic coverage and evidence labels are shown separately so a sparse estimate is inspectable.

## Willingness

100 × volunteered eligible invitation windows / total eligible invitation windows. One signal per window, not tap count or speed. Eligibility requires connection, microphone preflight, table membership, and completion of prior mandatory peer competence ratings. Cancelled windows and participants disconnected at closure are excluded. Selection is separately logged. The host selects the lowest current composite among volunteers; ties prefer fewer prior contributions, then stable roster ordering.

## Peer competence and historical influence

The three 1–5 competence statements are averaged and linearly mapped to 0–100. Missing ratings remain missing, not negative. A missing peer component starts with a neutral prior of 50; the absence of evidence is displayed. Self-rating and cross-table rating are prohibited.

Peer reputation uses current AI standing and current peer standing in equal proportion. Convert each to a midrank percentile, preserving ties. Influence = 0.5 + 0.5 × (AI percentile + peer percentile), bounded to [0.5,1.5]. Before evidence, everyone has weight 1. Every recalculation recomputes historical ratings using current rater influence, not the weight at submission. Each original rating also retains its submission-time rank/AI/peer snapshot.

Iterate peer weighted means with 0.5 damping, tolerance 0.001, maximum 40 iterations. Percentile-based feedback is discontinuous and convergence is not guaranteed; record the actual convergence status and show provisional results if not converged. AI remains the independent anchor for rater authority; willingness never directly increases peer authority. Preserve original ratings and calculation snapshots so influence changes are explainable.

Composite = (AI weight × AI mastery + peer weight × peer competence + willingness weight × willingness) / 100. Defaults: 50/30/20. Sort descending; equal composite values within 0.00001 share rank. Historical points are never reweighted by peer reputation.

## Evidence and grouping

“Established” means ≥3 assessed answers, ≥2 correctly evidenced topics and ≥3 peer ratings; “Developing” means some assessed answers; otherwise “Limited”. These are coverage indicators, not confidence intervals. Grouping uncertainty heuristic is 1/sqrt(1 + assessed answers + peer rating count/3).

Round one shuffles participants. Later groups seed from high-uncertainty participants, prefer comparable current mastery, add a cross-level anchor, and heavily penalize repeat tablemates. Local swaps reduce repeats further. Sizes remain 3–5. Assignment reasons are retained. Next groups are committed at the start of the transition using then-current evidence, so students' movement instructions do not change underfoot. Rank continues updating afterward.

## Presentation diagnostics and result status

The two fluency/appearance composite ratings are private diagnostics. They affect neither scores nor grouping. Associations with competence ratings do not by themselves establish bias.

Exports are PROVISIONAL if the exam is unfinished, grading is unresolved, mandatory competence ratings are missing, or influence iteration has not converged. REHEARSAL results are always labeled REHEARSAL. ASSESSED is an application-completion status, not institutional certification. No automatic official grade conversion.
