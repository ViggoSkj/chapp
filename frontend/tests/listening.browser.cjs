const assert = require('assert/strict');
const { chromium } = require('playwright');
const path = require('path');
const origin = process.env.LEARNING_TEST_ORIGIN || 'http://127.0.0.1:3010';
const out = process.env.LEARNING_TEST_OUTPUT || require('os').tmpdir();
const prompt = '我很好。';
const questions = new Map();
const reviews = new Map();
const generated = [];
const patternRequests = [];
let patternUncertain = true;
const events = [];
const submissions = [];
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
    if (new URL(route.request().url()).pathname === "/chapbackend-api/usage/events") return route.fulfill({ contentType: "application/json", body: "{\"accepted\":true}" });
    const endpoint = new URL(route.request().url()).pathname.replace('/chapbackend-api', '');
    let body = {};
    try { body = route.request().postDataJSON() || {}; } catch {}
    let result;
    if (endpoint === '/me') result = { chapp_user_id: 'listening-owner' };
    else if (endpoint === '/login-completions') result = { source_state: 'ready' };
    else if (endpoint === '/attempts') result = Array.from(reviews.values()).map(item => item.answer);
    else if (endpoint.endsWith('/pattern-practice')) {
      patternRequests.push(body);
      if (patternUncertain) { patternUncertain = false; await route.abort('failed'); return; }
      const original = reviews.get(endpoint.split('/')[2]).question;
      result = { id: uuid(), mandarin: '', difficulty: original.difficulty, listening: original.listening };
      questions.set(result.id, result);
    }
    else if (endpoint === '/exercises') {
      generated.push(body);
      if (uncertain) { uncertain = false; await route.abort('failed'); return; }
      if (unavailable) { await route.fulfill({ status: 400, contentType: 'text/plain', body: typeof unavailable === 'string' ? unavailable : 'no-eligible-characters' }); return; }
      result = { id: uuid(), mandarin: prompt, difficulty: body.difficulty, listening: body.listening };
      questions.set(result.id, result);
    } else if (endpoint.endsWith('/sound') && badAudio) { await route.fulfill({ status: 400, contentType: 'text/plain', body: 'invalid-listening-content' }); return; }
    else if (endpoint.endsWith('/sound')) result = { content_type: 'audio/mpeg', audio_data: 'SUQzAQ==', timings: Array.from(prompt).map((character, index) => ({ character, start_seconds: index * .3, end_seconds: (index + 1) * .3 })) };
    else if (endpoint.startsWith('/exercises/') && endpoint.endsWith('/attempts')) {
      submissions.push(body);
      const question = questions.get(endpoint.split('/')[2]);
      result = { answer: { id: uuid(), exercise_id: question.id, text: body.text, dont_know: body.dont_know, submitted_at: '2026-11-03T15:00:00Z' },
        question: { ...question, content: { mandarin: prompt, english: 'I am well.', pinyin: 'wǒ hěn hǎo' } },
        assessments: [{ id: 'grade', state: 'completed', result: { correctness: body.dont_know ? 0 : 1, feedback: 'Good meaning.', suggested_translation: 'I am well.' } }] };
      reviews.set(result.answer.id, result);
    } else if (endpoint.endsWith('/events')) {
      events.push(body);
      result = { saved: true };
    }
    else if (endpoint.startsWith('/exercises/')) result = questions.get(endpoint.split('/')[2]);
    else if (endpoint.startsWith('/attempts/')) result = reviews.get(endpoint.split('/')[2]);
    else if (endpoint === '/learning-help/stream') {
      if (!body.context.revealed) assert.deepEqual(body.context.content, [], 'Hidden transcript must not enter companion context.');
      const frames = [{ type: 'delta', text: 'Listen again for the sounds.' }, { type: 'done' }];
      await route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: frames.map(frame => JSON.stringify(frame) + '\n').join('') });
      return;
    } else throw new Error('Unexpected endpoint: ' + endpoint);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  const hidden = async () => {
    // Wait for the asynchronous next-exercise transition to remove the previous revealed transcript.
    await page.waitForFunction(() => !document.querySelector('p[lang="zh-CN"]'));
    assert.equal(await page.locator('p[lang="zh-CN"]').count(), 0);
    assert.equal(await page.getByRole('region', { name: 'Current exercise', exact: true }).getByText('I am well.', { exact: true }).count(), 0);
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
    await page.getByRole('button', { name: /^(Listen|Replay audio)$/, exact: true }).waitFor();
    assert.deepEqual(generated.at(-1).listening, { length_level: 0, character_difficulty: 0 });
    await hidden();
    await page.getByRole('button', { name: /^(Listen|Replay audio)$/, exact: true }).click();
    await page.getByRole('button', { name: 'Replay audio', exact: true }).waitFor();
    await hidden();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    const replayStart = page.waitForResponse(response => response.url().endsWith('/events') && response.request().postDataJSON().kind === 'audio-started');
    await page.getByRole('button', { name: 'Replay audio', exact: true }).click();
    await replayStart;
    assert.equal(events.filter(event => event.kind === 'audio-started').length, 2);
    assert.equal(new Set(events.filter(event => event.kind === 'audio-started').map(event => event.event_id)).size, 2);
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.evaluate(() => {
      const now = performance.now.bind(performance);
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      performance.now = () => now() + 120000;
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByRole('button', { name: 'Ask about your practice', exact: true }).click();
    await page.getByPlaceholder('Ask about your practice…').fill('Can you give a hint?');
    await page.getByRole('button', { name: 'Send ↑', exact: true }).click();
    await page.getByText('Listen again for the sounds.', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Close learning chat' }).click();
    await page.screenshot({ path: path.join(out, 'listening-desktop.png'), fullPage: true });
    await page.getByRole('textbox', { name: /What did you hear/ }).fill('I am well.');
    await page.getByRole('textbox', { name: /What did you hear/ }).press('Control+Enter');
    await page.getByText('wǒ hěn hǎo', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Explore 我', exact: true }).waitFor();
    assert.ok(Number.isInteger(submissions[0].active_milliseconds));
    assert.ok(submissions[0].active_milliseconds > 0 && submissions[0].active_milliseconds < 120000, 'Hidden time must not count.');
    assert.equal(await page.getByRole('list', { name: 'Exercise progress' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Practice this pattern' }).count(), 0);
    const savedAttempts = page.getByRole('region', { name: 'Saved attempts', exact: true });
    await savedAttempts.getByRole('searchbox').fill('no matching answer');
    await savedAttempts.getByText('No saved answers match your search.').waitFor();
    await savedAttempts.getByRole('searchbox').fill('well');
    assert.equal(await savedAttempts.getByRole('button').count(), 1);
    await savedAttempts.getByRole('searchbox').fill('');
    await page.screenshot({ path: path.join(out, 'exercise-review-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: /^(Listen|Replay audio)$/, exact: true }).click();
    await page.waitForFunction(() => !!document.querySelector('p[lang="zh-CN"] [data-speaking="true"]'));
    await page.reload();
    await page.getByText('wǒ hěn hǎo', { exact: true }).waitFor();
    // Keyboard changes affect only the next exercise and remain independent.
    await length.focus(); await length.press('End');
    assert.equal(await length.inputValue(), '4'); assert.equal(await difficulty.inputValue(), '0');
    await difficulty.focus(); await difficulty.press('ArrowRight');
    assert.equal(await length.inputValue(), '4'); assert.equal(await difficulty.inputValue(), '1');
    await page.getByRole('button', { name: 'Next listening exercise', exact: true }).click();
    await page.getByRole('button', { name: /^(Listen|Replay audio)$/, exact: true }).waitFor();
    assert.deepEqual(generated.at(-1).listening, { length_level: 4, character_difficulty: 1 });
    await hidden();
    await page.reload(); await page.getByRole('button', { name: /^(Listen|Replay audio)$/, exact: true }).waitFor(); await hidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow();
    await page.screenshot({ path: path.join(out, 'listening-mobile.png'), fullPage: true });
    badAudio = true;
    await page.getByRole('button', { name: /^(Listen|Replay audio)$/, exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'saved listening exercise contains repeated filler' }).waitFor();
    badAudio = false;
    unavailable = true;
    await page.getByRole('button', { name: 'Next listening exercise', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'No reviewed characters are available' }).waitFor();
    await hidden();
    for (const [code, expected] of [['insufficient-listening-vocabulary', 'reviewed vocabulary is too small'], ['invalid-listening-content', 'A natural phrase could not'], ['no-natural-sentence', 'A natural phrase could not']]) {
      unavailable = code;
      await page.getByRole('button', { name: 'Next listening exercise', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: expected }).waitFor();
      await hidden();
    }
    unavailable = false;
    uncertain = true;
    await page.getByRole('button', { name: 'Next listening exercise', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: /fetch|request/i }).waitFor();
    const retryKey = generated.at(-1).request_id;
    await page.getByRole('button', { name: 'Next listening exercise', exact: true }).click();
    await page.getByRole('button', { name: /^(Listen|Replay audio)$/, exact: true }).waitFor();
    assert.equal(generated.at(-1).request_id, retryKey);
    await page.getByRole('button', { name: 'Don’t know', exact: true }).click();
    await page.getByText('wǒ hěn hǎo', { exact: true }).waitFor();
    await noOverflow();
    const followUp = page.getByRole('button', { name: 'Practice this pattern', exact: true });
    await followUp.click();
    await page.getByRole('alert').filter({ hasText: /fetch|request/i }).waitFor();
    await followUp.click();
    await hidden();
    assert.equal(patternRequests.length, 2);
    assert.equal(patternRequests[0].request_id, patternRequests[1].request_id);
    assert.equal(await page.getByRole('region', { name: 'Answer review' }).count(), 0);
    await page.getByRole('button', { name: 'Listen', exact: true }).waitFor();
    const readingId = uuid();
    questions.set(readingId, { id: readingId, mandarin: prompt, difficulty: 'beginner', listening: null });
    await page.goto(origin + '/listening?exercise=' + readingId);
    await page.getByRole('button', { name: /^(Listen|Replay audio)$/, exact: true }).waitFor();
    await hidden();
    assert.deepEqual(errors, []);
    console.log('Listening desktop/mobile: independent sliders, hidden transcript/context, cached playback/highlight, saved reveal/reopen, empty familiarity and safe retry passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
