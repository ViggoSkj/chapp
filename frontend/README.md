# Chapp frontend

The Next.js application lives here. Start with the [documentation map](docs/README.md)
for current composition, exercise state, and development checks. Read
[AGENTS.md](AGENTS.md) and [product requirements](FRONTEND-REQUIREMENTS.md) first.
Use Node 24 and the pinned pnpm version. Production is packaged with the backend
repository's Linux release builder and hosted behind Nginx and Neuron.

## Login and connected endpoints

The frontend provides /login, a signed-in header, sign-out, live account and Anki
status on /connections, and the existing authenticated sentence/history flows.
Overview and Progress use saved practice aggregates. Vocabulary reads reviewed expressions from Anki. Only Anki Reviews remains labelled demo data. Listening is live.

Configure the Next.js server with CHAP_AUTH_ORIGIN (the internal Neuron origin)
and CHAP_PUBLIC_ORIGIN (the browser-facing origin). The deployed values are
http://neuron:8090 and http://neuron.viggoskj.com. These are server configuration,
not NEXT_PUBLIC values, and must not contain credentials. Existing /chapbackend-api
requests use Nginx routing in production; CHAP_BACKEND_ORIGIN still supports the
optional development rewrite.

POST /api/auth/login accepts the login form and performs Neuron's nonce/proof
exchange on the server, forwarding its HttpOnly session cookie to the browser.
It requires the configured same-origin request and X-Chapp-Request: 1. It never
stores passwords or puts credentials in local storage. POST /api/auth/logout
invalidates the Neuron session and clears its cookie. Server-side hashing and
getRandomValues-based request IDs support the owner's temporary HTTP deployment.

The account uses /me, /login-completions, and /status. History requests always
include offset=0&limit=20. A successful login does not create a learner or start
billable generation. Live Anki refresh is read-only; generation/grading run only
when requested from sentence practice.

Run authentication and existing practice checks with a current Node runtime:

```sh
node --test tests/auth.test.mjs tests/request-id.test.mjs tests/practice.test.mjs
pnpm build
```

## Learning UX requirements

See [FRONTEND-REQUIREMENTS.md](FRONTEND-REQUIREMENTS.md) for the owner's requested
answer-reveal states across all modes, character-meaning lookups after reveal,
and a contextual question window in the lower-right corner. These are shared requirements that must remain true when changing the implemented flows.


## Learning companion and character exploration

The shared learning companion appears in the lower-right corner. Signed-in
learners can ask about the active page without copying the exercise manually.
After reveal, Chinese characters open meaning/pronunciation panels. Character
sound and issued sentence playback use the authenticated backend database cache.
The backend requires its existing OpenAI settings for explanations and existing
ElevenLabs settings for audio; no provider credentials belong in the browser.

Run the existing Node tests with a compatible Node 24 runtime:

    node --test tests/*.test.mjs

An optional mocked browser regression is retained as
tests/learning-support.browser.cjs. With Playwright available through normal Node
resolution and Microsoft Edge installed, start the app on port 3010 and run:

    node tests/learning-support.browser.cjs

LEARNING_TEST_ORIGIN overrides the local origin; LEARNING_TEST_OUTPUT selects a
screenshot folder (otherwise the system temporary folder is used). All API
requests in this browser test are mocked; it does not make paid provider calls.


## Real Daily practice

/practice uses the authenticated failed-question endpoint and the shared sentence
workflow. Learners can revisit an original question with a fresh answer or explicitly
generate a new sentence. References are hidden for each fresh attempt. Queue paging,
reload restoration, assessment retry, empty/error states, and Anki-refresh outages
are covered by tests/practice-queue.browser.cjs. Sentence and Daily practice also offer a "Don't know"
button: it sends dont_know with empty text (any typed draft is discarded), the
backend scores it 0 without an AI call, and the question stays in the practice
queue; the same browser test covers it. Run it like the learning-support
browser regression with the same optional origin/output environment settings.


## Real Overview and Progress

Both routes use authenticated GET /chapbackend-api/progress. They display saved
submission totals, latest-valid-grade averages, questions needing practice, UTC
current/best streaks, and 7/28-day activity charts with accessible daily counts.
Ungraded attempts are shown separately; an explicit "Don't know" is a completed
zero-score attempt. No vocabulary mastery, Anki due counts,
study duration, or sample milestones are inferred. Data covers the current learner
storage; older history has not been migrated. Remaining sample modes are clearly
identified in the Overview toolkit and keep their route-level Demo banners.

The screens handle loading, empty history, signed-out/unlinked accounts, account
outages, progress failures and explicit refresh without making provider calls or
refreshing Anki. API failures never fall back to demo numbers. Progress data is
scoped to the current account and discarded when its identity changes.

The portable mocked browser regression is tests/progress.browser.cjs. Start the
frontend on port 3010 and run it with Playwright available through Node resolution:

    node tests/progress.browser.cjs

It uses LEARNING_TEST_ORIGIN and LEARNING_TEST_OUTPUT like the other browser tests.


## Personalized practice and live Vocabulary

New sentences give extra emphasis to eligible characters from recent incorrect,
partly correct, or "Don't know" answers. Successful answers reduce that emphasis.
The backend reads up to 200 recent attempts, counts each question once, and keeps
weights within the current reviewed Anki character boundary. It does not claim
character mastery or guarantee that a requested character appears in every sentence.

Vocabulary now reads GET /chapbackend-api/vocabulary with literal expression
search, pagination, distinct expression/character counts, and source-read time.
Refresh from Anki explicitly uses the existing read-only refresh operation.
Source outages are shown as errors; a failed refresh preserves the labelled last
successful snapshot. New/learning/relearning cards are excluded. Only expression
fields are currently mapped, so pinyin, dictionary definitions and mastery labels
are not invented. Individual character exploration uses the shared AI companion.

Anki expressions remain in memory. Vocabulary-help request/response payloads are
omitted from stored provider evidence so echoed expressions are not persisted;
only run/component/phase metadata is retained. Chat stays in the current session.

tests/vocabulary.browser.cjs covers search, paging, character context, refresh,
source outages, empty/error/account states and desktop/mobile layout. Run it with
the same LEARNING_TEST_ORIGIN / LEARNING_TEST_OUTPUT options as the other portable
browser regressions. tests/vocabulary.test.mjs verifies bounded Unicode-safe chat
context without truncating any row in the ten-expression view.


## Audio-synchronized characters

Cached speech responses include original-character start/end intervals. The
shared audio hook follows media time so highlighting stays synchronized at
slower rates, through replay and seeks. Sentence and Daily practice highlight
the prompt while keeping before-reveal characters noninteractive. The character
panel highlights its own selected character during playback. Timings and audio
are stored together in the backend database; the timestamp provider version
prevents reuse of old audio-only entries.

tests/audio-timing.test.mjs covers timing validation, repeated/supplementary
characters, silent gaps and boundaries. tests/timed-audio.browser.cjs uses a
deterministic media clock to verify speed, pause/buffering/replay/stop, reveal
rules, character audio, stale events, invalid data and desktop/mobile layout.
Run it with the same LEARNING_TEST_ORIGIN / LEARNING_TEST_OUTPUT options as the
other browser regressions. No live synthesis is needed for these regressions.


## Live listening practice

/listening shares the reading-practice character supply, AI generator, answer
submission, evaluation and history. It selects easier settings and an audio-first
formatter, hiding the sentence until answer reveal. Independent sliders control
length (3–5, 6–10, 11–20, 21–35, 36–60 Han characters) and character preference.
Easy favors familiar reviewed vocabulary; high uses normal mistake-focused
practice weights. All reviewed eligibility and expression context stay available
for natural sentences. The former hard listening interval filters are removed.

The AI must produce meaningful Mandarin and may decline impossible constraints.
Structural checks reject chants/repeated padding, while normal reduplication is
allowed. Old filler cannot be replayed or newly graded; history is preserved.
Friendly errors never silently change settings or substitute sample content.

Chinese/pinyin/meaning and companion transcript context stay hidden until review.
Shared cached audio supports slow replay and revealed-character highlighting.
Reopening restores saved controls. Listening is live; only Anki Reviews is a demo.

tests/listening.browser.cjs covers keyboard controls, hidden content/context,
replay highlighting, saved reload, filler/refusal errors, retry and mobile layout.


## Playback warm-up

Shared audio playback decodes cached audio locally and creates a WAV with a
600 ms silent prefix in the same media stream. This gives audio outputs time to
wake without fading/trimming speech. Highlighting subtracts that prefix from
audio.currentTime, preserving stored provider timestamps and slow playback.
Original cache bytes and timing data are unchanged. Replay starts from the same
original data, and stale asynchronous decoding cannot restart cancelled audio.
Unsupported decoding falls back to original media with zero timing offset.
tests/audio-warmup.test.mjs verifies PCM/header/sample preservation and fallback;
tests/audio-warmup.browser.cjs verifies real browser decoding, lead-in/highlight
timing, replay, cancellation during decoding, and character-panel playback.
