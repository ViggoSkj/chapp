const assert = require('assert/strict');
const { chromium } = require('playwright');
const path = require('path');
const origin = process.env.LEARNING_TEST_ORIGIN || 'http://127.0.0.1:3010';
const out = process.env.LEARNING_TEST_OUTPUT || require('os').tmpdir();
const prompt = '我很好。';
const questions = new Map();
const reviews = new Map();
const generated = [];
const errors = [];
let unavailable = false;
let uncertain = false;
let id = 0;
const uuid = () => '00000000-0000-4000-8000-' + String(++id).padStart(12, '0');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.audioTest = { instances: [] };
    window.Audio = class {
      constructor(src) { this.src = src; this.currentTime = 0; this.playbackRate = 1; this.paused = true; this.ended = false; window.audioTest.instances.push(this); }
      play() { this.paused = false; this.onplaying?.(); return Promise.resolve(); }
      pause() { this.paused = true; this.onpause?.(); }
    };
  });
  await page.route('**/chapbackend-api/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.replace('/chapbackend-api', '');
    let body = {};
    try { body = route.request().postDataJSON() || {}; } catch {}
    let result;
    if (endpoint === '/me') result = { chapp_user_id: 'listening-owner' };
    else if (endpoint === '/login-completions') result = { source_state: 'ready' };
    else if (endpoint === '/attempts') result = Array.from(reviews.values()).map(item => item.answer);
    else if (endpoint === '/exercises') {
      generated.push(body);
      if (uncertain) { uncertain = false; await route.abort('failed'); return; }
      if (unavailable) { await route.fulfill({ status: 400, contentType: 'text/plain', body: 'no-familiar-listening-characters' }); return; }
      result = { id: uuid(), mandarin: prompt, difficulty: body.difficulty, listening: body.listening };
      questions.set(result.id, result);
    } else if (endpoint.endsWith('/sound')) result = { content_type: 'audio/mpeg', audio_data: 'SUQzAQ==', timings: Array.from(prompt).map((character, index) => ({ character, start_seconds: index * .3, end_seconds: (index + 1) * .3 })) };
    else if (endpoint.startsWith('/exercises/') && endpoint.endsWith('/attempts')) {
      const question = questions.get(endpoint.split('/')[2]);
      result = { answer: { id: uuid(), exercise_id: question.id, text: body.text, dont_know: body.dont_know, submitted_at: '2026-11-03T15:00:00Z' },
        question: { ...question, content: { mandarin: prompt, english: 'I am well.', pinyin: 'wǒ hěn hǎo' } },
        assessments: [{ id: 'grade', state: 'completed', result: { correctness: body.dont_know ? 0 : 1, feedback: 'Good meaning.', suggested_translation: 'I am well.' } }] };
      reviews.set(result.answer.id, result);
    } else if (endpoint.endsWith('/events')) result = { saved: true };
    else if (endpoint.startsWith('/exercises/')) result = questions.get(endpoint.split('/')[2]);
    else if (endpoint.startsWith('/attempts/')) result = reviews.get(endpoint.split('/')[2]);
    else if (endpoint === '/learning-help') {
      if (!body.context.revealed) assert.deepEqual(body.context.content, [], 'Hidden transcript must not enter companion context.');
      result = { reply: { text: 'Listen again for the sounds.', language: 'en' } };
    } else throw new Error('Unexpected endpoint: ' + endpoint);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  const hidden = async () => {
    assert.equal(await page.locator('p[lang="zh-CN"]').count(), 0);
    assert.equal(await page.getByText('I am well.', { exact: true }).count(), 0);
    assert.equal(await page.getByText('wǒ hěn hǎo', { exact: true }).count(), 0);
    assert.equal(await page.locator('button[aria-label^="Explore "]').count(), 0);
  };
  try {
    await page.goto(origin + '/listening');
    await page.getByRole('button', { name: 'Start listening practice', exact: true }).waitFor();
    assert.equal(await page.getByText('DEMO', { exact: true }).count(), 0);
    const length = page.getByRole('slider', { name: /Sentence length/ });
    const difficulty = page.getByRole('slider', { name: /Character difficulty/ });
    assert.equal(await length.inputValue(), '0');
    assert.equal(await difficulty.inputValue(), '0');
    await page.getByRole('button', { name: 'Start listening practice', exact: true }).click();
    await page.getByRole('button', { name: 'Listen', exact: true }).waitFor();
    assert.deepEqual(generated.at(-1).listening, { length_level: 0, character_difficulty: 0 });
    await hidden();
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await page.getByRole('button', { name: 'Replay', exact: true }).waitFor();
    await hidden();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.getByRole('button', { name: 'Ask about your practice', exact: true }).click();
    await page.getByPlaceholder('Ask about your practice…').fill('Can you give a hint?');
    await page.getByRole('button', { name: 'Send ↑', exact: true }).click();
    await page.getByText('Listen again for the sounds.', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Close learning chat' }).click();
    await page.screenshot({ path: path.join(out, 'listening-desktop.png'), fullPage: true });
    await page.getByRole('textbox', { name: /What did you hear/ }).fill('I am well.');
    await page.getByRole('button', { name: 'Submit for grading', exact: true }).click();
    await page.getByText('wǒ hěn hǎo', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Explore 我', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await page.waitForFunction(() => !!document.querySelector('p[lang="zh-CN"] [data-speaking="true"]'));
    await page.reload();
    await page.getByText('wǒ hěn hǎo', { exact: true }).waitFor();
    // Keyboard changes affect only the next exercise and remain independent.
    await length.focus(); await length.press('End');
    assert.equal(await length.inputValue(), '4'); assert.equal(await difficulty.inputValue(), '0');
    await difficulty.focus(); await difficulty.press('ArrowRight');
    assert.equal(await length.inputValue(), '4'); assert.equal(await difficulty.inputValue(), '1');
    await page.getByRole('button', { name: 'Next listening exercise', exact: true }).click();
    await page.getByRole('button', { name: 'Listen', exact: true }).waitFor();
    assert.deepEqual(generated.at(-1).listening, { length_level: 4, character_difficulty: 1 });
    await hidden();
    await page.reload(); await page.getByRole('button', { name: 'Listen', exact: true }).waitFor(); await hidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow();
    await page.screenshot({ path: path.join(out, 'listening-mobile.png'), fullPage: true });
    unavailable = true;
    await page.getByRole('button', { name: 'Next listening exercise', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'No reviewed characters meet' }).waitFor();
    await hidden(); unavailable = false;
    uncertain = true;
    await page.getByRole('button', { name: 'Next listening exercise', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: /fetch|request/i }).waitFor();
    const retryKey = generated.at(-1).request_id;
    await page.getByRole('button', { name: 'Next listening exercise', exact: true }).click();
    await page.getByRole('button', { name: 'Listen', exact: true }).waitFor();
    assert.equal(generated.at(-1).request_id, retryKey);
    await page.getByRole('button', { name: 'Don’t know', exact: true }).click();
    await page.getByText('wǒ hěn hǎo', { exact: true }).waitFor();
    await noOverflow();
    assert.deepEqual(errors, []);
    console.log('Listening desktop/mobile: independent sliders, hidden transcript/context, cached playback/highlight, saved reveal/reopen, empty familiarity and safe retry passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
