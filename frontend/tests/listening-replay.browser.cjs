const assert = require('assert/strict');
const { chromium } = require('playwright');
const path = require('path');
const origin = process.env.LEARNING_TEST_ORIGIN || 'http://localhost:3010';
const out = process.env.LEARNING_TEST_OUTPUT || require('os').tmpdir();
const prompt = '我很好。';
const questions = new Map();
const reviews = new Map();
const generated = [];
const errors = [];
let unavailable = false;
let badAudio = false;
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
      if (unavailable) { await route.fulfill({ status: 400, contentType: 'text/plain', body: typeof unavailable === 'string' ? unavailable : 'no-eligible-characters' }); return; }
      result = { id: uuid(), mandarin: prompt, difficulty: body.difficulty, listening: body.listening };
      questions.set(result.id, result);
    } else if (endpoint.endsWith('/sound') && badAudio) { await route.fulfill({ status: 400, contentType: 'text/plain', body: 'invalid-listening-content' }); return; }
    else if (endpoint.endsWith('/sound')) result = { content_type: 'audio/mpeg', audio_data: 'SUQzAQ==', timings: Array.from(prompt).map((character, index) => ({ character, start_seconds: index * .3, end_seconds: (index + 1) * .3 })) };
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
  try {
    await page.goto(origin + '/listening');
    await page.getByRole('button', { name: 'Start listening practice', exact: true }).click();
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await page.getByRole('button', { name: 'Replay audio', exact: true }).waitFor();
    await page.evaluate(() => { const audio = window.audioTest.instances.at(-1); audio.ended = true; audio.paused = true; audio.onended?.(); });
    await page.getByRole('button', { name: 'Replay audio', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Listen', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Replay audio', exact: true }).click();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.getByRole('button', { name: 'Replay audio', exact: true }).waitFor();
    await page.getByRole('textbox', { name: /What did you hear/ }).fill('I am well.');
    await page.getByRole('button', { name: 'Submit for grading', exact: true }).click();
    await page.getByRole('region', { name: 'Answer review' }).waitFor();
    await page.getByRole('button', { name: 'Replay audio', exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Replay audio', exact: true }).click();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.getByRole('button', { name: 'Next listening exercise', exact: true }).click();
    await page.getByRole('button', { name: 'Listen', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Replay audio', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('Listening replay: stable after completion, stop, answer reveal and mobile replay; resets for next question.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });