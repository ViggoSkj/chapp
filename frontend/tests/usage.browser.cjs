const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const origin = process.env.LEARNING_TEST_ORIGIN || 'http://127.0.0.1:3010';
  const events = [], errors = [];
  let adminStatus = 200, question = null;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/chapbackend-api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/chapbackend-api', '');
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : {};
    let result;
    if (path === '/usage/events') {
      events.push(body);
      result = { accepted: true };
    } else if (path === '/me') result = { chapp_user_id: 'usage-owner' };
    else if (path === '/login-completions') result = { source_state: 'ready' };
    else if (path === '/attempts' || path === '/exercises/failed') result = [];
    else if (path === '/daily-plan/session') result = [{ kind: 'reading' }];
    else if (path === '/exercises') {
      question = { id: 'usage-question', mandarin: '你好。', difficulty: 'beginner', answer_language: 'en' };
      result = question;
    } else if (path.endsWith('/events')) result = { saved: true };
    else if (path.endsWith('/attempts')) result = {
      answer: { id: 'usage-answer', exercise_id: question.id, text: body.text, submitted_at: new Date().toISOString() },
      question: { ...question, content: { mandarin: '你好。', english: 'Hello.', pinyin: 'nǐ hǎo' } },
      assessments: [{ state: 'completed', result: { correctness: 1, feedback: 'Good.', suggested_translation: 'Hello.' } }],
    };
    else if (path === '/admin/usage') {
      if (adminStatus !== 200) return route.fulfill({ status: adminStatus, body: 'denied' });
      const groups = new Map();
      for (const event of events) {
        const key = [event.kind, event.name, event.page, event.layout, event.viewport].join('|');
        if (!groups.has(key)) groups.set(key, { ...event, count: 0, errors: 0, average: 0, p95: 0 });
        groups.get(key).count++;
      }
      result = {
        since: new Date(Date.now() - 7 * 86400000).toISOString(), through: new Date().toISOString(),
        retention_days: 90, sessions: new Set(events.map(event => event.session)).size,
        dropped_events: 0, persistence_failures: 0, buckets: [...groups.values(),
          { kind: 'request', name: 'POST /chapbackend-api/exercises', page: '', layout: '', viewport: '', count: 4, errors: 1, average: 1200, p95: 2200 }],
      };
    } else throw new Error('Unexpected mocked route ' + path);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
  });
  try {
    await page.goto(origin + '/practice');
    await page.waitForFunction(() => document.querySelector('button') !== null);
    await page.getByRole('radio', { name: 'Compact', exact: true }).check();
    await page.getByRole('button', { name: 'Create daily plan', exact: true }).click();
    await page.getByRole('textbox', { name: /Your English translation/ }).fill('private translation marker');
    await page.getByRole('button', { name: 'Submit for grading', exact: true }).click();
    await page.getByRole('button', { name: 'Finish daily plan', exact: true }).click();
    await page.waitForTimeout(100);
    assert.ok(events.some(event => event.name === 'plan-created'));
    assert.ok(events.some(event => event.name === 'plan-completed'));
    assert.ok(events.some(event => event.name === 'layout-changed' && event.layout === 'compact'));
    assert.equal(events.filter(event => event.kind === 'page' && event.page === '/practice').length, 1);
    const session = events[0].session;
    assert.ok(events.every(event => event.session === session));
    assert.ok(!JSON.stringify(events).includes('private translation marker'));
    assert.ok(events.every(event => Object.keys(event).sort().join(',') === 'id,kind,layout,name,page,session,value,viewport'));

    await page.goto(origin + '/usage?token=private-search');
    await page.getByRole('heading', { name: 'API requests', exact: true }).waitFor();
    assert.ok(!JSON.stringify(events).includes('private-search'));
    assert.ok(events.every(event => event.session === session), 'Tab session persists across reload');
    await page.getByRole('cell', { name: 'POST /chapbackend-api/exercises', exact: true }).waitFor();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
    const stream = await (await download).createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.equal(JSON.parse(Buffer.concat(chunks).toString()).retention_days, 90);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    adminStatus = 403;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'administrator' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'API requests', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('Usage tracking and administrator report passed: fixed fields, sessions, plan funnel, layout, export, authorization and mobile.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
