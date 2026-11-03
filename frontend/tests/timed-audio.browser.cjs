const assert = require('assert/strict');
const { chromium } = require('playwright');
const path = require('path');
const origin = process.env.LEARNING_TEST_ORIGIN || 'http://127.0.0.1:3010';
const out = process.env.LEARNING_TEST_OUTPUT || require('os').tmpdir();
const prompt = '你你𠀀。';
const intervals = [
  { character: '你', start_seconds: 0, end_seconds: 0.2 },
  { character: '你', start_seconds: 0.3, end_seconds: 0.55 },
  { character: '𠀀', start_seconds: 0.55, end_seconds: 0.95 },
  { character: '。', start_seconds: 1, end_seconds: 1 },
];
let generation = 0;
let invalid = false;
const errors = [];
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
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
    if (endpoint === '/me') result = { chapp_user_id: 'audio-owner' };
    else if (endpoint === '/login-completions') result = { source_state: 'ready' };
    else if (endpoint === '/attempts') result = [];
    else if (endpoint === '/exercises') result = { id: '00000000-0000-4000-8000-' + String(++generation).padStart(12, '0'), mandarin: prompt, difficulty: 'beginner' };
    else if (endpoint.endsWith('/sound')) result = { content_type: 'audio/mpeg', audio_data: 'SUQzAQ==',
      timings: invalid ? [{ character: '你', start_seconds: 1, end_seconds: 0 }] : endpoint === '/learning-help/sound'
        ? [{ character: body.character, start_seconds: 0, end_seconds: 0.6 }] : intervals };
    else if (endpoint.endsWith('/attempts')) result = {
      answer: { id: '10000000-0000-4000-8000-000000000001', exercise_id: endpoint.split('/')[2], text: body.text, submitted_at: '2026-11-03T12:00:00Z' },
      question: { id: endpoint.split('/')[2], difficulty: 'beginner', content: { mandarin: prompt, english: 'PRIVATE_REFERENCE', pinyin: 'PRIVATE_PINYIN' } },
      assessments: [{ id: 'graded', state: 'completed', result: { correctness: 1, feedback: 'Good meaning.', suggested_translation: 'Hello.' } }]
    };
    else if (endpoint === '/learning-help') result = { reply: { text: 'A character explanation.', language: 'en' }, pronunciation: { text: 'nǐ', language: 'zh-Latn-pinyin' } };
    else if (endpoint.endsWith('/events')) result = { saved: true };
    else throw new Error('Unexpected endpoint: ' + endpoint);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  const speaking = page.locator('p[lang="zh-CN"] [data-speaking="true"]');
  const position = async index => page.waitForFunction(expected => {
    const element = document.querySelector('p[lang="zh-CN"] [data-speaking="true"]');
    return expected === null ? !element : element && Array.from(element.parentElement.children).indexOf(element) === expected;
  }, index);
  const advance = async time => page.evaluate(value => {
    const audio = window.audioTest.instances.at(-1); audio.currentTime = value; audio.ontimeupdate?.();
  }, time);
  try {
    await page.goto(origin + '/sentences');
    await page.getByRole('button', { name: 'Generate sentence', exact: true }).click();
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await position(0);
    assert.equal(await page.locator('button[aria-label^="Explore "]').count(), 0, 'Highlighting must not unlock character answers before reveal.');
    assert.equal(await page.getByText('PRIVATE_REFERENCE', { exact: true }).count(), 0);
    await advance(0.35); await position(1);
    assert.equal(await speaking.textContent(), '你');
    await advance(0.65); await position(2);
    assert.equal(await speaking.textContent(), '𠀀');
    await advance(0.25); await position(null);
    await advance(1.05); await position(null);
    await advance(0.35); await position(1);
    await page.getByRole('button', { name: 'Replay', exact: true }).click();
    await position(0);
    await page.evaluate(() => window.audioTest.instances[0].onended?.());
    await position(0);
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await position(null);
    await page.locator('summary').filter({ hasText: 'Audio settings' }).click();
    await page.getByLabel('Playback speed').selectOption('0.65');
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await page.getByRole('button', { name: 'Replay', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.audioTest.instances.at(-1).playbackRate), 0.65);
    await advance(0.35); await position(1);
    await page.evaluate(() => window.audioTest.instances.at(-1).pause());
    await position(null);
    await page.evaluate(() => window.audioTest.instances.at(-1).play());
    await position(1);
    await page.evaluate(() => { const audio = window.audioTest.instances.at(-1); audio.onwaiting?.(); });
    await position(null);
    await page.evaluate(() => { const audio = window.audioTest.instances.at(-1); audio.onplaying?.(); });
    await position(1);
    await page.getByLabel('Your English translation').fill('Hello');
    await page.getByRole('button', { name: 'Submit for grading' }).click();
    await page.getByText('PRIVATE_REFERENCE', { exact: false }).waitFor();
    await position(1);
    assert.equal(await speaking.evaluate(element => element.tagName), 'BUTTON');
    await page.screenshot({ path: path.join(out, 'timed-audio-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(out, 'timed-audio-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.getByRole('button', { name: 'Explore 𠀀', exact: true }).click();
    const details = page.getByRole('dialog', { name: 'About 𠀀' });
    await details.getByRole('button', { name: /Listen to character/ }).click();
    await details.locator('h2 [data-speaking="true"]').waitFor();
    await page.getByRole('button', { name: 'Close character details' }).click();
    const previous = await page.evaluate(() => window.audioTest.instances.length);
    await page.getByRole('button', { name: 'Generate next sentence', exact: true }).click();
    await position(null);
    invalid = true;
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'The audio timing response was invalid.' }).waitFor();
    await position(null);
    assert.equal(await page.evaluate(() => window.audioTest.instances.length), previous, 'Invalid intervals must not create a playing audio instance');
    assert.deepEqual(errors, []);
    console.log('Timed-audio browser checks passed: repeated/supplementary characters, silent gaps, playback speed, pause/buffering/replay/stop, reveal rules, character-panel audio, navigation, invalid data and mobile layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
