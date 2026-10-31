This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Login and connected endpoints

The frontend provides /login, a signed-in header, sign-out, live account and Anki
status on /connections, and the existing authenticated sentence/history flows.
The overview, vocabulary, review and progress examples remain labelled demo data.

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
and a contextual question window in the lower-right corner. These are recorded
requirements for future implementation.


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
