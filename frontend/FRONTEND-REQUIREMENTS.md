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

Implemented for Overview, Vocabulary, Anki reviews, Progress, Daily practice,
and Listening practice. Login, Connections, and Sentence practice use live
services and must not be marked Demo. Update this classification when a page
switches to real data; being signed in alone does not make a demo page live.
