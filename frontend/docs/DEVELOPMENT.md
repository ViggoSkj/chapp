# Frontend change guide

Read [AGENTS.md](../AGENTS.md), the [documentation index](README.md), and the
relevant installed Next guide before changing code. Product behavior belongs in
[FRONTEND-REQUIREMENTS.md](../FRONTEND-REQUIREMENTS.md). These notes describe the
source inspected on 2026-11-07.

## Development environment

Use Node 24 and the package-manager version pinned in [package.json](../package.json).
Run from `frontend/`. Preserve the committed pnpm lockfile and workspace policy.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Configure the server origins described in [composition](COMPOSITION.md) for a
real backend. For UI regression work, use mocked browser fixtures without live
provider calls. Production packaging uses the Linux frontend Dockerfile and
release builder in the separate backend repository. Its deployment runbook owns
publishing, proxy configuration, backups, and recovery. The generated Next
starter's generic Vercel advice does not describe this project's deployment.

## Where to make changes

| Task | Start here | Useful regression |
| --- | --- | --- |
| Exercise states or daily plan | `app/components/sentence-exercise.tsx` | `feedback.browser.cjs`, `practice-queue.browser.cjs` |
| Layout dimensions or preference | `exercise-layout.tsx`, `language-practice.module.css` | `feedback.browser.cjs` |
| Listening controls or reveal | Shared exercise, `app/lib/listening.ts` | `listening.browser.cjs`, `listening-replay.browser.cjs` |
| Learning companion or character panel | `learning-support.tsx`, learning API, character cache | Learning-support and character-cache browser tests |
| Sound timing or output startup | Cached-audio hook, timing and warm-up libraries | Audio unit tests and timed-audio/warm-up browser tests |
| Login or account state | Account provider, auth routes, Neuron auth helper | Auth unit tests and signed-out/account-change browser states |
| Progress, vocabulary, or goals | Owning feature component and API helper | Corresponding browser test |
| Analytics or report | Usage observer, usage library, report component | `usage.browser.cjs` |

Component filenames in this table are under `app/components` unless qualified.
The [composition map](COMPOSITION.md) links to their actual locations.
Keep the exercise workflow shared across modes. Trace the complete request and
account lifecycle before adding another effect or cache. On errors, preserve
labelled last-successful state where supported and never substitute sample
numbers for an unsuccessful live request.

## Verification

From `frontend/`, run relevant checks using the compatible Node runtime.

```sh
node --test tests/*.test.mjs
pnpm exec tsc --noEmit --incremental false
pnpm lint
pnpm build
```

Node unit tests cover auth, request identities, practice contracts, context,
vocabulary, and audio transformations. Browser regressions are separate `.cjs`
scripts in [tests](../tests), requiring Playwright through Node resolution and
the browser configured by each script. Start the app on port 3010 or point
`LEARNING_TEST_ORIGIN` at your running build, then run the relevant script.

```sh
node tests/feedback.browser.cjs
```

`LEARNING_TEST_OUTPUT` selects the screenshot directory for scripts that support
it. Fixtures mock backend traffic and must also handle global usage requests.
Inspect each script's setup before use. Cover signed-out/unlinked accounts,
identity changes, errors, loading, reveal, reload, and mobile layout when affected.
Mocked browser success establishes frontend behavior against those contracts;
server integration requires separate backend checks. Do not call paid generation
or synthesis as a routine UI test.

Document actual checks and limits in handoff. For documentation-only edits,
compare facts with source and validate links. Keep new lasting knowledge in the
focused guide instead of growing a chronological README. Never include cookies,
passwords, provider keys, raw learning content, or private environment files.
