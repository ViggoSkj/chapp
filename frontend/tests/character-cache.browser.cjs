const { chromium } = require('playwright');
const assert = require('node:assert/strict');

function wave() {
  const buffer = Buffer.alloc(44 + 32000);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36);
  buffer.writeUInt32LE(32000, 40); return buffer.toString('base64');
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], calls = [], questions = new Map(), reviews = new Map();
  let n = 0, holdContext = true, failContext = false, releaseContext;
  let gate = new Promise(resolve => { releaseContext = resolve; });
  const origin = process.env.LEARNING_TEST_ORIGIN || 'http://localhost:3018';
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/chapbackend-api/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.replace('/chapbackend-api', '');
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
    calls.push({ endpoint, body });
    let value;
    if (endpoint === '/me') value = { chapp_user_id: 'cache-owner' };
    else if (endpoint === '/login-completions') value = { source_state: 'ready' };
    else if (endpoint === '/attempts' || endpoint === '/exercises/failed') value = [];
    else if (endpoint === '/exercises') {
      value = { id: 'q' + (++n), mandarin: '你好。', difficulty: 'beginner', answer_language: 'en' };
      questions.set(value.id, value);
    } else if (endpoint.endsWith('/attempts')) {
      const question = questions.get(endpoint.split('/')[2]);
      value = { answer: { id: 'a' + n, exercise_id: question.id, text: body.text, submitted_at: new Date().toISOString() },
        question: { ...question, content: { mandarin: '你好。', english: 'Hello.', pinyin: 'nǐ hǎo' } },
        assessments: [{ state: 'completed', result: { correctness: 1, feedback: 'Good.', suggested_translation: 'Hello.' } }] };
      reviews.set(value.answer.id, value);
    } else if (endpoint.startsWith('/attempts/')) value = reviews.get(endpoint.split('/')[2]);
    else if (endpoint === '/learning-help/character') value = {
      reply: { text: 'General meaning: you.', language: 'en' }, pronunciation: { text: 'nǐ', language: 'zh-Latn-pinyin' },
    };
    else if (endpoint === '/learning-help') {
      if (holdContext) await gate;
      if (failContext) { await route.fulfill({ status: 503, body: '{}' }).catch(() => {}); return; }
      value = { reply: { text: 'Fresh phrase explanation.', language: 'en' }, pronunciation: { text: 'nǐ', language: 'zh-Latn-pinyin' } };
    } else if (endpoint === '/learning-help/sound') value = {
      content_type: 'audio/wav', audio_data: wave(), timings: [{ character: '你', start_seconds: 0, end_seconds: 1.7 }],
    };
    else if (endpoint.endsWith('/events')) value = { saved: true };
    else throw new Error('Unexpected endpoint: ' + endpoint);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) }).catch(() => {});
  });
  const open = async () => page.getByRole('button', { name: 'Explore 你', exact: true }).first().click();
  const count = endpoint => calls.filter(call => call.endpoint === endpoint).length;
  try {
    await page.goto(origin + '/sentences');
    await page.getByRole('button', { name: 'Generate sentence', exact: true }).click();
    await page.getByRole('textbox', { name: /Your English translation/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Explore 你', exact: true }).count(), 0);
    await page.getByRole('textbox', { name: /Your English translation/ }).fill('Hello');
    await page.getByRole('button', { name: 'Submit for grading', exact: true }).click();
    await open();
    const dialog = page.getByRole('dialog', { name: 'About 你' });
    await dialog.getByText('General meaning: you.', { exact: true }).waitFor();
    await dialog.getByText('nǐ', { exact: true }).waitFor();
    await dialog.getByText('Loading phrase context…', { exact: true }).waitFor();
    assert.equal(count('/learning-help/character'), 1);
    await page.waitForFunction(() => document.querySelector('[role=dialog]'));
    await dialog.getByRole('button', { name: '◖ Listen to character', exact: true }).click();
    await dialog.getByRole('button', { name: 'Stop audio', exact: true }).waitFor();
    assert.equal(count('/learning-help/sound'), 1, 'Opening and playback share one audio fetch');
    await dialog.getByRole('button', { name: 'Close character details' }).click();

    // Warm definition renders while a new contextual request remains pending.
    await open();
    await dialog.getByText('General meaning: you.', { exact: true }).waitFor();
    await dialog.getByText('Loading phrase context…', { exact: true }).waitFor();
    assert.equal(count('/learning-help/character'), 1, 'Reopen uses cached general definition');
    holdContext = false; releaseContext();
    await dialog.getByText('Fresh phrase explanation.', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Close character details' }).click();

    // Browser persistence survives full reload; failed context keeps both basics and audio usable.
    failContext = true;
    await page.reload();
    await open();
    await dialog.getByText('General meaning: you.', { exact: true }).waitFor();
    await dialog.getByRole('alert').waitFor();
    assert.equal(count('/learning-help/character'), 1, 'Reload restores general definition from browser storage');
    await dialog.getByRole('button', { name: '◖ Listen to character', exact: true }).click();
    await dialog.getByRole('button', { name: 'Stop audio', exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await dialog.getByRole('button', { name: 'Close character details' }).click();
    failContext = false;
    await open();
    await dialog.getByText('Fresh phrase explanation.', { exact: true }).waitFor();
    assert.equal(count('/learning-help/sound'), 2, 'Replay after reload reuses the learner audio buffer');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks: ['reveal gate', 'basic meaning before context', 'pinyin before context', 'audio before context', 'coalesced audio', 'warm reopen', 'persistent reload', 'independent context failure', 'fresh context', 'mobile layout'], requests: calls.length }));
  } finally { releaseContext(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
