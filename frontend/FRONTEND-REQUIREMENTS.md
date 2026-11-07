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

Implemented for Anki reviews. Listening now uses live practice services. Vocabulary now reads reviewed Anki expressions.
Overview and Progress now use real saved practice aggregates. Login, Connections,
Sentence practice, Daily practice, Overview, and Progress use live services and
must not be marked Demo. Update this classification when a page
switches to real data; being signed in alone does not make a demo page live.


## Implemented learning support (2026-10-31)

- Shared lower-right chat receives explicit current mode, reveal state and bounded recent actions.
- Sentence practice, Daily practice, listening and vocabulary publish their visible content and enable individual character exploration after reveal.
- Character panels show AI explanations and pinyin, with audio through the backend database sound cache. This implements the owner request for cached character sound; a separate dictionary provider is not configured.
- Issued sentence playback also uses server-cached sound. Listening uses the same cached server audio as sentence practice.
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
- Vocabulary has no Demo banner. Anki reviews retains its banner; Listening is now live.
- Loading/outage states show no fabricated rows. A failed refresh keeps the last
  valid source clearly dated. Account changes hide the previous account's rows.
- Ten-expression pages keep all visible text in bounded Unicode-safe learning
  context. Vocabulary chat and provider echoes must not persist Anki expressions.


## Spoken-character highlighting (2026-11-03)

- Highlight the current original character using server-stored provider timing
  and the audio element's currentTime. Keep correct positions for repeated and
  supplementary Han characters and synchronize at every playback speed.
- Share this behavior across real sentence/Daily practice and character-panel
  audio. Before reveal, highlighting does not enable character explanations.
- Stop/pause/buffering, completion, playback errors and navigation clear highlights;
  cancelled/stale responses never update the next exercise. Missing timing data
  must not produce guessed highlighting. Listening also uses timed server audio; its transcript stays hidden before reveal.


## Live listening practice (owner request 2026-11-03)

- Separate sentence length and character difficulty sliders. Start at 3–5 Chinese
  characters and characters known well; length can increase independently through
  36–60 characters. Settings apply to the next exercise and restore on saved reload.
- Owner clarification: listening uses the same character supply, AI sentence
  generator and evaluator as reading. Difficulty changes preferences toward
  familiar characters; do not create a separate hard-filtered listening pool.
  Other reviewed vocabulary remains available to form meaningful sentences.
- Hide Chinese/pinyin/meaning before answering, including the companion's context.
  Submit an English meaning or Don't know, then reveal saved review and character
  exploration. Use cached Mandarin audio with slow replay and after-reveal timed
  highlighting. Retain listening mode for saved attempts and practice-queue retries.
- Listening has no Demo badge. Anki Reviews remains a labelled demo.


## Shared practice pipeline (owner diagram, 2026-11-03)

Settings feed shared character supply and sentence generation. A formatter chooses
reading or hidden-sentence audio; answer interpretation, saved completion and
performance evaluation remain shared. The shortest setting still means natural
3–5-character phrases, never random strings or length-padding repetition.


## Audio warm-up (owner request 2026-11-03)

The beginning of speech was hard to hear. Shared cached playback now prepends
600 ms of actual silence in the same local media stream, allowing the output
device to wake before the first syllable. Never fade or trim that syllable.
Subtract the media lead-in from the highlighting clock; before speech begins no
character is highlighted. Apply to sentence/listening/Daily practice and character
audio, at every speed and replay. Navigation/stop cancels pending decoding too.
Stored audio/timings remain original, so no cache deletion or paid regeneration
is required. Browsers unable to decode locally retain original playback.

## Exercise studio refinement (2026-11-04)

- Reading, listening and Daily practice share Prepare / Try it / Explore stages and mode navigation.
- Revealed answers separate reference, pinyin and assessment feedback, while keeping character exploration available.
- Saved attempts support local search of the most recent loaded submissions. Ctrl/Cmd+Enter submits a written answer.
- Shared surfaces, typography, touch targets and mobile layouts use the same visual system. Existing live/demo classifications and hidden-answer requirements remain in force.

## Weekly goals (2026-11-04)

Owner requested progress toward goals. Overview and Progress now show explicit persisted weekly practice-day and submission targets, UTC Monday weeks and a same-weekdays comparison. No target is claimed until saved. These track consistency, not mastery. Goal data stays scoped to the active learner; viewing remains read-only.


## Chapp Feedback implementation (2026-11-04)

Owner feedback read from the Chapp Feedback conversation: enlarge desktop companion; rename Sentences to Mandarin → English translation; hide translation audio before answering; add English → Mandarin; replace Daily practice entry with duration-based Daily Q&A using an injectable planner; pre-generate the next exercise after answering and discard mismatched settings. Listening still requires audio before answering. Desktop companion is resizable and mobile remains constrained. Daily plan duration is an estimate, initially two minutes per exercise, not measured study time or AI adaptation. Background requests keep their idempotency key on uncertain failure and remain private until Next. Plans are current-session controls; issued questions and submissions remain saved on the server.


## Listening replay clarification (2026-11-04)

Replay audio remains a stable control after the first successful playback, including after completion, stopping and answer reveal. Only a new question resets it to Listen. Listening audio remains available before answering; translation audio remains after-answer only.


## Remove exercise stage cards (2026-11-04)

Owner called out Prepare / Try it / Explore as unwanted remaining UI while asking for all feedback to be read. Removed the stage strip across reading, listening and Daily Q&A; this supersedes the earlier exercise-studio stage-card implementation note. Keep answer reveal states and character exploration functional without presenting them as three extra cards. The app tool exposes five Chapp Feedback entries and one desktop-chat screenshot, with no older-page cursor; Prepare/Try it/Explore was supplied in this conversation. Do not claim the tool exposed additional feedback it did not return.



## Character lookup cache (owner request 2026-11-07)

Show reusable general character meaning and pinyin immediately from a cache;
load sentence-specific context independently after selection. General definitions
use a character-only provider context, versioned durable database storage, and
bounded browser storage. Never cache a phrase explanation as a general definition
or include page content, actions, Anki expressions, or chat in the shared entry.
The character endpoint must authorize reveal, ownership and membership before
reading a cache hit. Audio continues through the shared database-backed sound
provider; the panel prepares it on opening and reuses bounded learner-scoped
in-memory audio for replay. Playback stays explicit. Standalone audio can differ
from a polyphonic character's phrase reading, which the panel labels separately.
An unseen character still needs one initial generation; later definitions persist
across sessions and restarts. No bulk paid dictionary warm-up is performed.
