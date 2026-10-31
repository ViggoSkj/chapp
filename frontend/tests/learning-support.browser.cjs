const assert = require('assert/strict');
const { chromium } = require('playwright');
const out = (process.env.LEARNING_TEST_OUTPUT || require('os').tmpdir()).replaceAll('\\', '/');
const testOrigin = process.env.LEARNING_TEST_ORIGIN || 'http://localhost:3010';
const exerciseId = '11111111-1111-4111-8111-111111111111';
const attemptId = '22222222-2222-4222-8222-222222222222';
const calls = [];
const errors = [];
let generation = 0;
function wave() {
  const buffer = Buffer.alloc(44 + 16000);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36);
  buffer.writeUInt32LE(16000, 40); return buffer.toString('base64');
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
    calls.push({ endpoint, body });
    let result;
    if (endpoint === '/me') result = { chapp_user_id: 'owner' };
    else if (endpoint === '/login-completions') result = { source_state: 'ready' };
    else if (endpoint === '/attempts') result = [];
    else if (endpoint === '/exercises/failed') result = [];
    else if (endpoint === '/exercises') {
      generation++;
      result = { id: generation === 1 ? exerciseId : '33333333-3333-4333-8333-333333333333', mandarin: generation === 1 ? '你好。' : '我你好。', difficulty: 'beginner' };
    } else if (endpoint.endsWith('/attempts')) result = {
      answer: { id: attemptId, exercise_id: endpoint.split('/')[2], text: body.text, submitted_at: '2026-10-31T12:00:00Z' },
      question: { id: endpoint.split('/')[2], difficulty: 'beginner', content: { mandarin: '你好。', english: 'Hello.', pinyin: 'Nǐ hǎo.' } },
      assessments: [{ id: 'grade', state: 'completed', result: { correctness: 1, feedback: 'You preserved the greeting.', suggested_translation: 'Hello.' } }],
    };
    else if (endpoint.endsWith('/sound')) result = { content_type: 'audio/wav', audio_data: wave() };
    else if (endpoint === '/learning-help') result = {
      reply: { text: body.character ? (body.character === '学' ? '学 means study or learn. In 学习 it means to study.' : '你 means “you”. In 你好 it forms the greeting “hello”.') : 'Look at how the two characters work together as a greeting.', language: 'en' },
      pronunciation: body.character ? { text: body.character === '学' ? 'xué' : 'nǐ', language: 'zh-Latn-pinyin' } : null,
    };
    else result = {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  try {
    await page.goto('' + testOrigin + '/sentences');
    await page.getByRole('button', { name: 'Generate sentence', exact: true }).click();
    await page.getByText('你好。', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Explore 你', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Ask about your practice', exact: true }).click();
    await page.getByLabel('Ask about your practice', { exact: true }).fill('Give me a hint.');
    await page.getByRole('button', { name: 'Send ↑', exact: true }).click();
    await page.getByText('Look at how the two characters work together as a greeting.').waitFor();
    let help = calls.filter(call => call.endpoint === '/learning-help').at(-1);
    assert.equal(help.body.context.revealed, false);
    assert.equal(help.body.context.exercise_id, exerciseId);
    assert.equal(help.body.context.content.length, 1);
    await page.getByLabel('Your English translation').fill('Hello');
    await page.getByRole('button', { name: 'Submit for grading' }).click();
    await page.getByText('You preserved the greeting.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Explore 你', exact: true }).click();
    await page.getByText('你 means “you”. In 你好 it forms the greeting “hello”.', { exact: true }).waitFor();
    await page.getByRole('button', { name: '◖ Listen to character', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('button') && true);
    await page.getByRole('button', { name: 'Stop audio', exact: true }).waitFor();
    help = calls.filter(call => call.endpoint === '/learning-help/sound').at(-1);
    assert.equal(help.body.character, '你');
    assert.equal(help.body.context.attempt_id, attemptId);
    assert.equal(help.body.context.revealed, true);
    await page.screenshot({ path: out + '/learning-support-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Close character details' }).click();
    await page.getByLabel('Ask about your practice', { exact: true }).fill('Explain the greeting.');
    await page.getByRole('button', { name: 'Send ↑', exact: true }).click();
    await page.getByText('Look at how the two characters work together as a greeting.').waitFor();
    help = calls.filter(call => call.endpoint === '/learning-help').at(-1);
    assert.equal(help.body.context.revealed, true);
    assert.ok(help.body.context.actions.some(action => action.includes('Selected character')));
    await page.getByRole('button', { name: 'Close learning chat' }).click();
    await page.getByRole('button', { name: 'Generate next sentence' }).click();
    await page.getByText('我你好。', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Explore 你', exact: true }).count(), 0);
    assert.equal(await page.getByRole('dialog').count(), 0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('' + testOrigin + '/practice');
    assert.equal(await page.locator('button[aria-label^="Explore "]').count(), 0);
    await page.getByRole('button', { name: 'Generate a new sentence', exact: true }).click();
    await page.getByLabel('Your English translation').fill('Hello');
    await page.getByRole('button', { name: 'Submit for grading' }).click();
    await page.locator('button[aria-label^="Explore "]').first().click();
    await page.getByRole('dialog').waitFor();
    await page.screenshot({ path: out + '/learning-support-mobile.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile layout must not overflow horizontally');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks: ['hidden-state hints', 'revealed character details', 'cached-audio request', 'context updates', 'exercise reset', 'mobile reveal and layout'], requests: calls.length }));
  } catch (error) { await page.screenshot({ path: out + '/learning-support-failure.png', fullPage: true }); console.error(JSON.stringify({ calls, errors, text: await page.locator('body').innerText() })); throw error; } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
