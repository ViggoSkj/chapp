const assert = require('assert/strict');
const { chromium } = require('playwright');
const origin = process.env.LEARNING_TEST_ORIGIN || 'http://127.0.0.1:3010';
const wave = Buffer.alloc(44 + 22050 * 2);
wave.write('RIFF'); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVE', 8); wave.write('fmt ', 12);
wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22); wave.writeUInt32LE(44100, 24);
wave.writeUInt32LE(88200, 28); wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34); wave.write('data', 36); wave.writeUInt32LE(44100, 40);
for (let sample = 0; sample < 22050; sample++) wave.writeInt16LE(Math.round(16000 * Math.cos(sample * 2 * Math.PI * 220 / 44100)), 44 + sample * 2);
let generated = 0;
const errors = [];
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.audioTest = { instances: [], holdDecode: false, resolveDecode: null };
    const ActualOffline = window.OfflineAudioContext;
    window.OfflineAudioContext = class extends ActualOffline {
      async decodeAudioData(data) {
        const buffer = await super.decodeAudioData(data);
        if (window.audioTest.holdDecode) await new Promise(resolve => { window.audioTest.resolveDecode = resolve; });
        return buffer;
      }
    };
    window.Audio = class {
      constructor(src) { this.src = src; this.currentTime = 0; this.playbackRate = 1; this.paused = true; this.ended = false; window.audioTest.instances.push(this); }
      play() { this.paused = false; this.onplaying?.(); return Promise.resolve(); }
      pause() { this.paused = true; this.onpause?.(); }
    };
  });
  await page.route('**/chapbackend-api/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.replace('/chapbackend-api', '');
    const body = route.request().postDataJSON() || {};
    let result;
    if (endpoint === '/me') result = { chapp_user_id: 'warmup-owner' };
    else if (endpoint === '/login-completions') result = { source_state: 'ready' };
    else if (endpoint === '/attempts') result = [];
    else if (endpoint === '/exercises') result = { id: '00000000-0000-4000-8000-' + String(++generated).padStart(12, '0'), mandarin: '你好', difficulty: 'beginner' };
    else if (endpoint.endsWith('/sound')) result = { content_type: 'audio/wav', audio_data: wave.toString('base64'), timings: endpoint === '/learning-help/sound'
      ? [{ character: body.character, start_seconds: 0, end_seconds: .5 }]
      : [{ character: '你', start_seconds: 0, end_seconds: .2 }, { character: '好', start_seconds: .2, end_seconds: .5 }] };
    else if (endpoint.endsWith('/attempts')) result = {
      answer: { id: '10000000-0000-4000-8000-000000000001', exercise_id: endpoint.split('/')[2], text: body.text, submitted_at: '2026-11-03T12:00:00Z' },
      question: { id: endpoint.split('/')[2], difficulty: 'beginner', content: { mandarin: '你好', english: 'Hello.', pinyin: 'nǐ hǎo' } },
      assessments: [{ id: 'grade', state: 'completed', result: { correctness: 1, feedback: 'Good.', suggested_translation: 'Hello.' } }]
    };
    else if (endpoint === '/learning-help') result = { reply: { text: 'You.', language: 'en' }, pronunciation: { text: 'nǐ', language: 'zh-Latn-pinyin' } };
    else if (endpoint.endsWith('/events')) result = { saved: true };
    else throw new Error('Unexpected endpoint: ' + endpoint);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  const advance = time => page.evaluate(value => { const audio = window.audioTest.instances.at(-1); audio.currentTime = value; audio.ontimeupdate?.(); }, time);
  const speaking = page.locator('p[lang="zh-CN"] [data-speaking="true"]');
  const waitForAudio = async count => page.waitForFunction(expected => window.audioTest.instances.length === expected && !window.audioTest.instances.at(-1).paused, count);
  const verifyPaddedClip = async () => {
    const clip = await page.evaluate(async () => {
      const audio = window.audioTest.instances.at(-1);
      const blob = await fetch(audio.src).then(response => response.blob());
      const bytes = await blob.arrayBuffer(); const view = new DataView(bytes);
      const rate = view.getUint32(24, true); const channels = view.getUint16(22, true);
      const start = 44 + Math.ceil(rate * .6) * channels * 2;
      return { type: blob.type, duration: view.getUint32(40, true) / (rate * channels * 2), silent: new Uint8Array(bytes, 44, start - 44).every(value => value === 0), firstSample: view.getInt16(start, true), playbackRate: audio.playbackRate };
    });
    assert.equal(clip.type, 'audio/wav'); assert.equal(clip.silent, true);
    assert.ok(Math.abs(clip.duration - 1.1) < .001); assert.ok(Math.abs(clip.firstSample - 16000) <= 2, 'First syllable must not be faded or trimmed.');
    return clip;
  };
  try {
    await page.goto(origin + '/sentences');
    await page.getByRole('button', { name: 'Generate sentence', exact: true }).click();
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await waitForAudio(1); await verifyPaddedClip();
    assert.equal(await speaking.count(), 0);
    await advance(.59); assert.equal(await speaking.count(), 0);
    await advance(.65); await page.waitForFunction(() => document.querySelector('p[lang="zh-CN"] [data-speaking="true"]')?.textContent === '你');
    await advance(.85); await page.waitForFunction(() => document.querySelector('p[lang="zh-CN"] [data-speaking="true"]')?.textContent === '好');
    await page.getByRole('button', { name: 'Replay', exact: true }).click();
    await waitForAudio(2); await verifyPaddedClip(); assert.equal(await speaking.count(), 0);
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    // A context switch during real decoding must not allow a late playback to start.
    await page.evaluate(() => { window.audioTest.holdDecode = true; });
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await page.waitForFunction(() => !!window.audioTest.resolveDecode);
    await page.getByRole('button', { name: 'Generate next sentence', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('exercise')?.endsWith('000000000002'));
    await page.evaluate(() => { window.audioTest.holdDecode = false; window.audioTest.resolveDecode(); });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
    assert.equal(await page.evaluate(() => window.audioTest.instances.length), 2);
    await page.getByText('Audio settings', { exact: true }).click();
    await page.getByLabel('Playback speed').selectOption('0.65');
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await waitForAudio(3); assert.equal((await verifyPaddedClip()).playbackRate, .65);
    await advance(.59); assert.equal(await speaking.count(), 0);
    await advance(.65); await page.waitForFunction(() => document.querySelector('p[lang="zh-CN"] [data-speaking="true"]')?.textContent === '你');
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.getByLabel('Your English translation').fill('Hello');
    await page.getByRole('button', { name: 'Submit for grading', exact: true }).click();
    await page.getByRole('button', { name: 'Explore 你', exact: true }).click();
    await page.getByRole('button', { name: /Listen to character/ }).click();
    await waitForAudio(4); await verifyPaddedClip();
    assert.equal(await page.locator('h2 [data-speaking="true"]').count(), 0);
    await advance(.65); await page.waitForFunction(() => !!document.querySelector('h2 [data-speaking="true"]'));
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log('Audio warm-up: real decoding, continuous 600 ms silence, preserved opening samples, highlight offsets, slow/replay, cancelled decoding, character audio and mobile passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
