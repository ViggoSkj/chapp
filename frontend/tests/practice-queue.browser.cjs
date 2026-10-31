const assert = require('assert/strict');
const { chromium } = require('playwright');
const origin = process.env.LEARNING_TEST_ORIGIN || 'http://localhost:3010';
const out = (process.env.LEARNING_TEST_OUTPUT || require('os').tmpdir()).replaceAll('\\', '/');
const sourceQuestions = Array.from({ length: 22 }, (_, index) => ({
  id: '00000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
  mandarin: index === 0 ? '你好。' : '我' + '你'.repeat(index + 1) + '好。',
  difficulty: 'beginner',
}));
let failed = [...sourceQuestions];
let queueUnavailable = false;
let signedIn = true;
let generations = 0;
let submissionCount = 0;
const reviews = new Map();
const calls = [];
const errors = [];
function reviewFor(question, body, completed) {
  submissionCount++;
  const dontKnow = body.dont_know === true;
  return {
    answer: { id: '10000000-0000-4000-8000-' + String(submissionCount).padStart(12, '0'),
      exercise_id: question.id, text: body.text, submitted_at: '2026-10-31T14:00:00Z', dont_know: dontKnow },
    question: { id: question.id, difficulty: question.difficulty,
      content: { mandarin: question.mandarin, english: 'PRIVATE_REFERENCE', pinyin: 'PRIVATE_PINYIN' } },
    assessments: [{ id: 'run-' + submissionCount, state: completed || dontKnow ? 'completed' : 'failed',
      result: dontKnow ? { correctness: 0, feedback: 'You chose "Don\'t know".', suggested_translation: 'PRIVATE_REFERENCE' }
        : completed ? { correctness: 1, feedback: 'You preserved the meaning.', suggested_translation: 'Hello.' } : undefined }],
  };
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/chapbackend-api/**', async route => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace('/chapbackend-api', '');
    let body = {};
    try { body = route.request().postDataJSON() ?? {}; } catch {}
    calls.push({ endpoint, method: route.request().method(), body });
    let status = 200, result = {};
    if (endpoint === '/me') {
      status = signedIn ? 200 : 401; result = signedIn ? { chapp_user_id: 'owner' } : {};
    } else if (endpoint === '/login-completions') {
      status = 503; result = { code: 'anki-read-failed' };
    } else if (endpoint === '/exercises/failed') {
      status = queueUnavailable ? 503 : 200;
      const offset = Number(url.searchParams.get('offset'));
      const limit = Number(url.searchParams.get('limit'));
      result = queueUnavailable ? { code: 'dependency-failed' } : failed.slice(offset, offset + limit);
    } else if (endpoint === '/attempts') {
      result = Array.from(reviews.values()).map(review => review.answer);
    } else if (endpoint === '/exercises') {
      generations++;
      result = { id: '90000000-0000-4000-8000-000000000001', mandarin: '我你好。', difficulty: body.difficulty };
    } else if (endpoint.startsWith('/exercises/') && endpoint.endsWith('/attempts')) {
      const id = endpoint.split('/')[2];
      const question = sourceQuestions.find(item => item.id === id);
      result = reviewFor(question, body, submissionCount === 0);
      reviews.set(result.answer.id, result);
      if (result.assessments[0].result?.correctness === 1) failed = failed.filter(item => item.id !== id);
    } else if (endpoint.endsWith('/assessment-retries')) {
      const id = endpoint.split('/')[2];
      const previous = reviews.get(id);
      result = { ...previous, assessments: [...previous.assessments, {
        id: 'retried', state: 'completed',
        result: { correctness: 1, feedback: 'You preserved the meaning.', suggested_translation: 'Hello.' },
      }] };
      reviews.set(id, result);
      failed = failed.filter(item => item.id !== previous.question.id);
    } else if (endpoint.startsWith('/attempts/')) {
      result = reviews.get(endpoint.split('/')[2]);
    } else if (endpoint.startsWith('/exercises/') && route.request().method() === 'GET') {
      result = sourceQuestions.find(item => item.id === endpoint.split('/')[2]);
    } else if (endpoint === '/learning-help') {
      result = { reply: { text: 'Consider how the sentence is structured.', language: 'en' }, pronunciation: null };
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(result) });
  });
  try {
    await page.goto(origin + '/practice');
    const queue = page.getByRole('region', { name: 'Your practice queue' });
    await queue.getByRole('button', { name: 'Retry next question', exact: true }).waitFor();
    await queue.getByRole('button', { name: 'Retry sentence ' + sourceQuestions[0].mandarin, exact: true }).waitFor();
    assert.equal(await page.getByText('DEMO', { exact: true }).count(), 0);
    assert.equal(await queue.locator('li').count(), 20);
    assert.equal(generations, 0, 'Loading the queue must not generate or bill for a new question.');
    await queue.getByRole('button', { name: 'More questions' }).click();
    await queue.getByRole('button', { name: 'Retry sentence ' + sourceQuestions[20].mandarin, exact: true }).waitFor();
    assert.equal(await queue.locator('li').count(), 2);
    await queue.getByRole('button', { name: 'Previous questions' }).click();
    await queue.getByRole('button', { name: 'Retry sentence ' + sourceQuestions[0].mandarin, exact: true }).waitFor();
    failed = sourceQuestions.slice(0, 2);
    await queue.getByRole('button', { name: 'Refresh queue' }).click();
    await page.waitForFunction(() => document.querySelectorAll('section[aria-label="Your practice queue"] li').length === 2);
    await queue.getByRole('button', { name: 'Retry next question', exact: true }).click();
    assert.equal(await page.getByLabel('Your English translation').inputValue(), '');
    assert.equal(await page.getByText('PRIVATE_REFERENCE', { exact: false }).count(), 0);
    assert.equal(await page.locator('button[aria-label^="Explore "]').count(), 0);
    assert.equal(generations, 0);
    await page.reload();
    await page.getByLabel('Your English translation').waitFor();
    await page.getByLabel('Your English translation').fill('Hello');
    await page.getByRole('button', { name: 'Submit for grading' }).click();
    await page.getByText('You preserved the meaning.', { exact: true }).waitFor();
    await queue.getByRole('button', { name: 'Retry sentence ' + sourceQuestions[0].mandarin, exact: true }).waitFor({ state: 'detached' });
    assert.equal(calls.filter(call => call.endpoint.endsWith('/attempts') && call.method === 'POST')[0].endpoint,
      '/exercises/' + sourceQuestions[0].id + '/attempts');
    await page.reload();
    await page.getByText('You preserved the meaning.', { exact: true }).waitFor();
    await page.screenshot({ path: out + '/practice-queue-desktop.png', fullPage: true });

    await queue.getByRole('button', { name: 'Retry next question', exact: true }).click();
    assert.equal(await page.getByLabel('Your English translation').inputValue(), '');
    assert.equal(await page.getByText('PRIVATE_REFERENCE', { exact: false }).count(), 0);
    assert.equal(await page.locator('button[aria-label^="Explore "]').count(), 0);
    await page.getByLabel('Your English translation').fill('A new answer');
    await page.getByRole('button', { name: 'Submit for grading' }).click();
    await page.getByText('This has not been counted as an incorrect answer.', { exact: false }).waitFor();
    assert.equal(failed.length, 1, 'A grading outage must not remove or create learner-failure evidence.');
    const submissions = calls.filter(call => call.endpoint.endsWith('/attempts') && call.method === 'POST');
    assert.notEqual(submissions[0].body.submission_id, submissions[1].body.submission_id);
    await page.getByRole('button', { name: 'Retry assessment', exact: true }).click();
    await page.getByText('You preserved the meaning.', { exact: true }).waitFor();
    await queue.getByText('No questions to revisit on this page.', { exact: false }).waitFor();
    await queue.getByRole('button', { name: 'Generate a new sentence' }).click();
    assert.equal(generations, 1);

    await page.setViewportSize({ width: 390, height: 844 });
    failed = sourceQuestions.slice(0, 1);
    await page.goto(origin + '/practice');
    await page.getByRole('button', { name: 'Retry sentence ' + sourceQuestions[0].mandarin, exact: true }).waitFor();
    await page.getByRole('button', { name: 'Retry next question', exact: true }).click();
    await page.getByLabel('Your English translation').waitFor();
    await page.screenshot({ path: out + '/practice-queue-mobile.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.getByLabel('Your English translation').fill('half an idea');
    await page.getByRole('button', { name: 'Don’t know', exact: true }).click();
    await page.getByText('You chose “Don’t know”.', { exact: true }).waitFor();
    await page.getByText('Correctness: 0.00 / 1', { exact: true }).waitFor();
    await page.getByText('PRIVATE_REFERENCE', { exact: false }).first().waitFor();
    const dontKnow = calls.filter(call => call.endpoint.endsWith('/attempts') && call.method === 'POST').at(-1);
    assert.equal(dontKnow.body.dont_know, true);
    assert.equal(dontKnow.body.text, '', 'A typed draft must not be sent with a "Don\'t know" choice.');
    assert.equal(await page.getByLabel('Your English translation').inputValue(), '', 'The discarded draft must not look like the saved answer.');
    assert.equal(await page.getByText('Suggested translation:', { exact: false }).count(), 0);
    assert.ok(failed.some(item => item.id === sourceQuestions[0].id), '"Don\'t know" keeps the question in the practice queue.');
    await page.getByRole('button', { name: /^Don’t know · / }).waitFor();
    await page.screenshot({ path: out + '/practice-dont-know-mobile.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

    queueUnavailable = true;
    await page.goto(origin + '/practice');
    await page.getByRole('button', { name: 'Reload practice queue' }).waitFor();
    assert.equal(await page.getByText('No questions to revisit on this page.', { exact: false }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Generate a new sentence' }).isDisabled(), false);
    queueUnavailable = false; failed = [];
    await page.getByRole('button', { name: 'Reload practice queue' }).click();
    await page.getByText('No questions to revisit on this page.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Retry next question', exact: true }).isDisabled(), true);
    signedIn = false;
    await page.goto(origin + '/practice');
    await page.getByRole('heading', { name: 'Sign in to practice' }).waitFor();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks: ['real queue pagination', 'source outage isolation',
      'fresh original-question attempts', 'reload restoration', 'correct-answer removal', 'ungraded outage and assessment retry',
      'explicit generation', 'mobile layout', "don't know scored 0 and kept in queue", 'queue errors and empty state', 'signed-out state'], requests: calls.length }));
  } catch (error) {
    await page.screenshot({ path: out + '/practice-queue-failure.png', fullPage: true });
    console.error(JSON.stringify({ errors, calls, text: await page.locator('body').innerText() }));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
