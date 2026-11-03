# Frontend learning experience requirements

Owner requirements recorded on 2026-10-27. These are planned product requirements,
not a statement that the features are already implemented.

## All practice modes have before-reveal and after-reveal states

Every frontend learning/practice mode must have two distinct states:

- **Before the answer is revealed:** show the exercise and the controls needed to
  attempt it, with the answer still hidden.
- **After the answer is revealed:** show the answer/review state and allow the
  learner to explore the characters in the content.

Apply this consistently across sentence practice, character/vocabulary practice,
listening, reviews, and any future practice modes. Do not implement it only for
the current sentence page.

## Character meanings after reveal

After the answer has been revealed, the learner must be able to click individual
Chinese characters to see their meanings. This interaction belongs in the shared
after-reveal experience across all modes.

The owner has not yet specified the dictionary provider, lookup presentation,
or how character meanings should be combined with compound-word meanings.

## Contextual question window

Provide a question/prompt window in the **lower-right corner** of the frontend so
the learner can ask questions about their current learning activity.

The window must have context about:

- What is on the current page, including the active mode and exercise content.
- Whether the answer is still hidden or has been revealed.
- What the learner just did, such as answering, revealing an answer, playing
  audio, selecting a character, or opening a saved attempt.
- The learner's submitted answer and the displayed answer/feedback, when those
  are part of the current page state.

The learner should be able to ask a question without manually copying this
context into the prompt.

## Implementation guidance

- Keep the reveal state, character lookup, and question-window context aligned
  as the learner moves between exercises and modes.
- Respect the before-reveal state when supplying context or answering questions;
  do not accidentally expose hidden reference answers.
- Use the active learner's authorized page data. Do not include passwords,
  API keys, session cookies, or unrelated learner history in question context.
- Preserve the question-window experience on smaller screens without covering
  the answer controls. Exact mobile layout and provider choices remain open.

Update this file when the owner clarifies or changes these preferences.

## Clearly label demo pages

Owner requirement added on 2026-10-27: every frontend page that is still in demo
mode must show a conspicuous Demo sticker/badge. Keep it visible on small screens
and explain that the page uses sample content rather than live study data.

Implemented for Anki reviews and Listening practice. Vocabulary now reads reviewed Anki expressions.
Overview and Progress now use real saved practice aggregates. Login, Connections,
Sentence practice, Daily practice, Overview, and Progress use live services and
must not be marked Demo. Update this classification when a page
switches to real data; being signed in alone does not make a demo page live.


## Implemented learning support (2026-10-31)

- Shared lower-right chat receives explicit current mode, reveal state and bounded recent actions.
- Sentence practice, Daily practice, listening and vocabulary publish their visible content and enable individual character exploration after reveal.
- Character panels show AI explanations and pinyin, with audio through the backend database sound cache. This implements the owner request for cached character sound; a separate dictionary provider is not configured.
- Issued sentence playback also uses server-cached sound. Existing standalone demo listening keeps its browser voice controls.
- Context switches clear prior conversation and character panels; desktop and mobile layouts and keyboard selection are covered by browser checks.
- The chat uses the configured backend AI provider. Its conversation stays in the current browser session; provider execution evidence is recorded by the backend.


## Real Daily practice queue (2026-10-31)

- Daily practice uses actual owned failed questions, with paging and a retry-or-generate choice. It is no longer a demo page.
- Trying a saved question starts a blank independent answer on the original question. Previous answer/reference content is hidden until the new submission is reviewed.
- Completed fully correct answers leave the queue. Failed or unfinished grading does not count as an incorrect new answer.
- Saved practice remains usable if Anki refresh fails. Queue errors, an empty queue, source refresh notices, and saved-answer state remain distinct.
- The existing shared chat, post-reveal character exploration, and database-cached audio also apply to this route.


## Real progress (2026-11-03)

- Overview and Progress share authenticated saved-practice totals and charts.
- Count original submissions once; average only latest valid completed grades.
  Assessment retries update an answer's grade, while failures stay ungraded.
- Show questions to revisit and current/best practice streaks. Activity and streaks
  explicitly use UTC submission days, including zero days in the chart.
- Never infer learned vocabulary, study duration, due Anki cards, or mastery from
  submission counts. Current learner storage coverage is explained on the page.
- Loading, empty, error, signed-out and unlinked states contain no demo fallback.
  Viewing or refreshing progress must not invoke paid providers or refresh Anki.


## Personalized practice and live vocabulary (2026-11-03)

- New sentence generation uses recent sentence results to guide character emphasis
  within the reviewed Anki boundary. Corrections and successful answers reduce it.
- Vocabulary displays actual reviewed expressions, with search, pagination,
  source-read time and explicit refresh. No sample mastery, pinyin or meanings are
  substituted for missing mapped fields. Shared character explanations remain AI-labelled.
- Vocabulary has no Demo banner. Anki reviews and Listening retain their banners.
- Loading/outage states show no fabricated rows. A failed refresh keeps the last
  valid source clearly dated. Account changes hide the previous account's rows.
- Ten-expression pages keep all visible text in bounded Unicode-safe learning
  context. Vocabulary chat and provider echoes must not persist Anki expressions.
