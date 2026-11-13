# LearnProof: the learning room

A small library of source-linked learning rooms for university learners who can reach the notes but get stuck on dense technical language. Built for AccessED Hacks by M J Anthony with AI assistance.

## Try it

Open `index.html` directly in a modern browser. No install, account, API key or server is needed; the GitHub Pages deployment serves exactly the same self-contained file, and `learnproof-offline.html` is an identical copy for saving. On the library screen, expand **Keep a copy & choose what is saved** for the offline download, device memory and session clearing.

## What's in the library

Four reviewed rooms, each running the same honest loop: a six-question diagnostic, a revision path ordered by lower-scoring concepts with original source passages, a hands-on lab, three practice questions with explanations, six different fresh-check questions, and an evidence report with every score traced to an actual answer.

| Room | Lab |
| --- | --- |
| Deadlocks, without the guesswork | Waiting-state model: set lock owners and requests, predict a cycle, inspect the trace |
| CPU scheduling: who runs next? | Scheduling simulator: set the workload, predict average waiting time, run FCFS / SJF / round robin |
| Paging: which page leaves memory? | Replacement replay: choose frames and policy, predict faults, step the reference string (FIFO / LRU / OPT) |
| Transactions: when is interleaving safe? | Schedule checker: build reads and writes, predict serializability, inspect the precedence graph |

Around the rooms: a **My learning** view aggregating per-room evidence, **display & access** settings (text size, a bundled OpenDyslexic typeface option, browser read-aloud with local/network voice labelling), per-room JSON evidence export and restore, a third recall question set, and a downloadable `.ics` recall reminder. This is not a broad course library, an arbitrary PDF tutor, or a synced account product.

## Architecture

`index.html` is the built, self-contained public app. Sources:

- `lessons/*.json` — the four reviewed lesson packs (source pages, concepts, 21 items each, lab config, references, limitations).
- `src/core.js` — `LPCore`: scoring, delta, path, evidence report, restore, pack validation. Pure functions.
- `src/labs.js` — `LPLabs`: the four deterministic lab engines. Pure functions.
- `src/app.js` — presentation, hash routing, storage, speech, downloads.
- `src/styles.css` — the navy/sky editorial identity; OpenDyslexic (SIL OFL 1.1, `fonts/OFL.txt`) is embedded at build time.
- `build.mjs` — dependency-free bundler: `node build.mjs` regenerates `index.html` and `learnproof-offline.html` from the sources.

The private Streamlit author workspace is separate and unchanged. No secrets or provider credentials are in this repository. Public room scoring never calls a model.

## The lab models

- **Waiting states:** one instance per non-reentrant lock; requests block; at most one pending request per thread; blocked threads keep their locks. Not a general Banker's-algorithm simulator.
- **Scheduling:** one CPU, no I/O, independent jobs, zero switch cost. FCFS and SJF are non-preemptive; SJF knows exact lengths here. Round robin re-queues a preempted job behind jobs that arrived during its slice.
- **Paging:** pure demand paging, equal pages, frames start empty. OPT reads the actual future of the typed string; it is a benchmark, not an implementable policy.
- **Transactions:** conflict serializability only. A conflict is two transactions, one item, at least one write. Acyclic precedence graph means serializable; a topological order is the serial equivalent. Locking and isolation levels are out of scope.

## Scoring and interpretation

Correct = 1 point. Wrong or unknown = 0. Each before/after form has two items per concept. Percentage-point change is `100 * (afterRight/afterTotal - beforeRight/beforeTotal)`. Practice is excluded. Submitted diagnostic answers are fixed until a new session starts.

The forms follow a topic blueprint but are not statistically equated. The material is builder-reviewed, not expert-certified. No efficacy study has been run. Reports are editable, self-reported and unproctored; identity, independence and timestamps are not verified. Restoring a report recalculates the totals from recorded choices instead of trusting stored totals. Scores do not establish mastery, retention or causation. Source-page labels refer to each room's bundled notes, not book pagination.

## Privacy and accessibility

The public room makes no network requests of its own: no analytics, external fonts, trackers or AI endpoints. The OpenDyslexic typeface is embedded in the page. Read-aloud uses the browser's own speech voices; voices not marked "local" may send the read text to a network service, and the browser decides what it reports. The hosting service can log ordinary page requests. Answers stay in session storage by default; optional local storage remembers this device. Downloaded reports are separate files and must be deleted separately. No learner names, accounts or educational records are needed.

Semantic headings, real form controls, a skip link, keyboard focus styles, live errors, text alternatives to diagrams and reduced-motion handling are included. Browser checks at 390 and 1280 pixels passed without horizontal page overflow. Automated axe-core scans of the library, report and access views found no serious or critical violations. This is not a WCAG certification, and no testing with real assistive technology (such as a screen reader) was available in the build environment.

## Verification

`verify.cjs` runs 92 checks: a reproducible-build assertion (the shipped `index.html` must equal a fresh `node build.mjs`), structural validation of all four packs, scoring/report/restore round-trips per pack, and known-answer plus invariant tests for every lab engine (all 4,096 deadlock waiting states; classic FIFO/LRU/OPT fault counts; FCFS/SJF/RR hand-computed schedules; precedence-graph edge ordering). Run `node verify.cjs` beside `index.html`. No dependencies are required.

`tests/ui.spec.mjs` runs 50 checks in real Chrome (needs `npm i` for playwright + axe-core, and a static server on :8377): the full diagnostic → path → lab → practice → fresh check → export → restore → recall workflow, My learning aggregation, all four labs, display & access settings, persistence, 390px mobile layout, axe scans, and the offline copy running from `file://`.

## Work dates, sources and AI assistance

A private prototype began 28 October 2026, within AccessED's event window. The 13 November v2 rebuild added the targeted path, waiting lab, confidence-linked corrections, local evidence restoration and separate recall set. The 13 November v3 rebuild added the four-room library (CPU scheduling, paging and transactions rooms are new), the scheduling/paging/transaction labs, My learning, display & access settings, read-aloud and calendar recall reminders.

M J Anthony directed the project. Implementation, teaching drafts, tests, UI, documentation and narration were created with AI assistance. The source passages, questions and worked examples are original. Reference reading: [OSTEP: Common Concurrency Problems](https://pages.cs.wisc.edu/~remzi/OSFEP/threads-deadlock.pdf), [OSTEP: Scheduling: Introduction](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf), [OSTEP: Beyond Physical Memory: Policies](https://pages.cs.wisc.edu/~remzi/OSTEP/vmm-beyondphys-policy.pdf), [PostgreSQL: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html). No external chapter text is bundled.

## Not implemented

Arbitrary PDF generation in the public demo, OCR, learner accounts or cross-device sync, teacher dashboards, automated reminders (the `.ics` file is user-saved, not scheduled), proctoring, verified retention tracking and broad subject coverage. Keeping a small claim honest is part of the design.
