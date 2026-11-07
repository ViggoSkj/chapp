const assert = require('assert/strict');
const path = require('path');
const { chromium } = require('playwright');
const origin = process.env.LEARNING_TEST_ORIGIN || 'http://127.0.0.1:3011';
const out = process.env.LEARNING_TEST_OUTPUT || require('os').tmpdir();
const expressions = ['你好', '学习', '朋友', ...Array.from({ length: 20 }, (_, index) => '词' + index.toString().padStart(2, '0'))];
let account = 200, available = true, refreshAvailable = true;
let collection = [...expressions];
let reads = 0;
const calls = [], errors = [];
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/chapbackend-api/**', async route => {
    if (new URL(route.request().url()).pathname === "/chapbackend-api/usage/events") return route.fulfill({ contentType: "application/json", body: "{\"accepted\":true}" });
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace('/chapbackend-api', '');
    let body = {};
    try { body = route.request().postDataJSON() || {}; } catch {}
    calls.push({ endpoint, method: route.request().method(), body });
    let status = 200, result;
    if (endpoint === '/me') { status = account; result = { chapp_user_id: 'vocabulary-owner' }; }
    else if (endpoint === '/vocabulary') {
      reads++;
      status = available ? 200 : 503;
      const search = url.searchParams.get('search') || '';
      const offset = Number(url.searchParams.get('offset'));
      const limit = Number(url.searchParams.get('limit'));
      const filtered = collection.filter(text => text.includes(search));
      result = { read_at: '2026-11-03T12:00:00Z', total_expressions: collection.length, total_characters: 8,
        filtered_count: filtered.length, offset, limit, entries: filtered.slice(offset, offset + limit).map(text => ({ text, character_count: 2 })) };
    } else if (endpoint === '/login-completions') {
      result = { source_state: refreshAvailable ? 'ready' : 'unavailable' };
    } else if (endpoint === '/learning-help') {
      result = { reply: { text: 'This character is used in your visible reviewed expression.', language: 'en' }, pronunciation: { text: 'nǐ', language: 'zh-Latn-pinyin' } };
    } else throw new Error('Unexpected request: ' + endpoint);
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(result) });
  });
  const rows = () => page.locator('tbody tr');
  const ready = async () => page.getByText('reviewed expressions', { exact: true }).waitFor();
  try {
    await page.goto(origin + '/vocabulary');
    await ready();
    assert.equal(await rows().count(), 10);
    assert.equal(await page.getByText('DEMO', { exact: true }).count(), 0);
    assert.equal(calls.filter(call => call.method === 'POST').length, 0, 'Browsing must not refresh Anki or invoke a provider automatically');
    await page.getByRole('button', { name: 'More expressions' }).click();
    await page.getByText('11–20 of 23', { exact: true }).waitFor();
    assert.equal(await rows().count(), 10);
    await page.getByRole('button', { name: 'More expressions' }).click();
    await page.getByText('21–23 of 23', { exact: true }).waitFor();
    assert.equal(await rows().count(), 3);
    assert.equal(await page.getByRole('button', { name: 'More expressions' }).isDisabled(), true);
    await page.getByLabel('Search reviewed expressions').fill('你好');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByText('1–1 of 1', { exact: true }).waitFor();
    assert.equal(await rows().count(), 1);
    await page.getByRole('button', { name: 'Explore 你', exact: true }).click();
    await page.getByText('This character is used in your visible reviewed expression.', { exact: true }).waitFor();
    const help = calls.find(call => call.endpoint === '/learning-help');
    assert.equal(help.body.context.revealed, true);
    assert.equal(help.body.context.mode, 'reviewed-vocabulary');
    assert.equal(help.body.context.content.map(item => item.text).join(''), '你好');
    await page.getByRole('button', { name: 'Close character details' }).click();
    await page.getByLabel('Search reviewed expressions').fill('');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByText('1–10 of 23', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(out, 'vocabulary-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(out, 'vocabulary-mobile.png'), fullPage: true });

    refreshAvailable = false;
    await page.getByRole('button', { name: 'Refresh from Anki' }).click();
    await page.getByRole('alert').filter({ hasText: 'Any displayed vocabulary is from the last successful read.' }).waitFor();
    assert.equal(await rows().count(), 10, 'A failed refresh preserves the clearly labelled last valid snapshot');
    refreshAvailable = true;
    collection = [];
    await page.getByRole('button', { name: 'Refresh from Anki' }).click();
    await page.getByRole('heading', { name: 'No reviewed expressions yet.' }).waitFor();
    assert.equal(await rows().count(), 0);
    collection = expressions;
    await page.getByRole('button', { name: 'Refresh from Anki' }).click();
    await page.getByText('1–10 of 23', { exact: true }).waitFor();
    await page.getByLabel('Search reviewed expressions').fill('不存在');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('heading', { name: 'No expressions match.' }).waitFor();
    available = false;
    await page.reload();
    await page.getByRole('heading', { name: 'Vocabulary is unavailable' }).waitFor();
    assert.equal(await rows().count(), 0);
    available = true;
    await page.getByRole('button', { name: 'Retry vocabulary' }).click();
    await ready();
    for (const [status, heading] of [[401, 'Bring your vocabulary into view.'], [403, 'Link your learner account']]) {
      account = status;
      const before = reads;
      await page.reload();
      await page.getByRole('heading', { name: heading }).waitFor();
      assert.equal(reads, before);
      assert.equal(await rows().count(), 0);
    }
    assert.deepEqual(errors, []);
    assert.ok(calls.filter(call => call.method === 'POST').every(call => ['/login-completions', '/learning-help'].includes(call.endpoint)));
    console.log('Vocabulary browser checks passed: real rows, paging/search, character context, explicit refresh, outage preservation, empty/auth/error states, desktop/mobile.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
