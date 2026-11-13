# LearnProof: the learning room

A source-linked learning diagnostic for university learners who can reach the notes but get stuck on dense technical language. Built for AccessED Hacks by M J Anthony with AI assistance.

## Try it

Open `index.html` directly in a modern browser. No install, account, API key or server is needed. The GitHub Pages deployment serves exactly the same self-contained file. On the home screen, expand **Keep a copy & choose what is saved**, then download the offline HTML room.

## A focused, working loop

1. Six diagnostic questions, with an honest "I do not know" choice and optional confidence.
2. A revision path ordered by lower-scoring concepts, with original source passages and worked examples.
3. A three-thread / three-lock waiting-state lab. Predict a cycle, change a state, and inspect actual blockers and a possible completion order. It distinguishes cycle members from a blocked dependent.
4. Three practice questions with explanations, separate from the comparison.
5. Six different fresh-check questions, no hints or answer feedback during the check.
6. An evidence report: actual choices, changes by concept, source-backed corrections, high-confidence errors and next steps.
7. Local JSON export/restore and a third six-question recall set. An immediate attempt is labelled as practice, not proof of retention.

One reviewed deadlock lesson, three concepts. This is not a broad course library or an arbitrary PDF tutor.

## Architecture

`index.html` is the complete public app. It contains:
- the original three-page teaching notes and 21 question items as JSON;
- `LPCore.score`, `delta`, `path`, `analyze`, `report` and `restore` as pure functions;
- the presentation, navigation, local storage and file-download layer.

The private Streamlit author workspace is separate. Its existing Groq draft generator only accepts bundled synthetic/non-sensitive notes, produces unreviewed author drafts, and is not called by this public room. No secrets or provider credentials are in this repository. Public room scoring never calls a model.

## The waiting model

There is one instance of each non-reentrant lock. Requests block, each thread has at most one pending request, and blocked threads keep their locks. A thread with no remaining blocker can finish and release its locks. The completion pass repeatedly removes such threads. A separate traversal finds closed waiting cycles. A dependent can be stuck behind a cycle without being a cycle member. This is not a general Banker's-algorithm implementation.

## Scoring and interpretation

Correct = 1 point. Wrong or unknown = 0. Each before/after form has two items per concept. Percentage-point change is `100 * (afterRight/afterTotal - beforeRight/beforeTotal)`. Practice is excluded. Submitted diagnostic answers are fixed until a new session starts.

The forms follow a topic blueprint but are not statistically equated. The material is builder-reviewed, not expert-certified. No efficacy study has been run. Reports are editable, self-reported and unproctored; identity, independence and timestamps are not verified. Restoring a report recalculates the totals from recorded choices instead of trusting stored totals. Scores do not establish mastery, retention or causation. Source-page labels refer to the three original bundled notes, not book pagination.

## Privacy and accessibility

The public room has no network requests, analytics, external fonts, trackers or AI endpoints of its own. The hosting service can log ordinary page requests. Answers stay in session storage by default. Optional local storage remembers this device; shared devices should leave it off and clear their session. Downloaded reports are separate files and must be deleted separately. No learner names, accounts or educational records are needed.

Semantic headings, real form controls, a skip link, keyboard focus styles, live errors, visible text alternatives to the diagram and reduced-motion handling are included. Browser checks at 320, 390 and 1280 pixels passed without horizontal page overflow. This is not a WCAG certification or a claim of screen-reader testing with real assistive technology.

## Verification

The implementation passed 35 core tests, including exhaustive invariants over all 4,096 combinations of the lab's three lock owners and three wait requests. A real Chrome workflow covered diagnostic -> path -> lab -> practice -> fresh check -> JSON download -> offline restoration -> recall, plus mobile layout and optional local storage. The scripted UI fixture was 0/6 before and 4/6 after. Those numbers are test choices, not learner results.

Public reproducible core checks are in `verify.cjs` when present: run `node verify.cjs` beside `index.html`. No dependencies are required. To test manually, use a fresh tab, choose unknown for the diagnostic, follow the path, change the lab from a two-thread cycle to a chain, finish practice and a fresh check, export, then open the offline download and restore the report. Try an invalid JSON report and an incomplete question as well. Use browser developer tools offline mode to check the downloaded room without a connection.

## Work dates, sources and AI assistance

A private prototype began 28 October 2026, within AccessED's event window. The 13 November v2 rebuild adds the targeted path, waiting lab, confidence-linked corrections, local evidence restoration, separate recall set and offline room. It preserves the light navy/sky-blue editorial identity rather than starting a different product.

M J Anthony directed the project. Implementation, teaching drafts, tests, UI, documentation and narration were created with AI assistance. The three source passages, questions and worked examples are original. Reference reading: [OSTEP, Common Concurrency Problems](https://pages.cs.wisc.edu/~remzi/OSFEP/threads-deadlock.pdf). No external chapter text is bundled.

## Not implemented

Arbitrary PDF generation in the public demo, OCR, persistent learner accounts, teacher dashboards, automated reminders, proctoring, verified retention tracking and broad subject coverage. Keeping a small claim honest is part of the design.
