const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = process.env.LEARNING_TEST_ORIGIN || 'http://localhost:3010';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let goals = null;
  let writes = 0;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/chapbackend-api/**', async route => {
    const endpoint = new URL(route.request().url()).pathname;
    let result;
    if (endpoint.endsWith('/me')) result = { chapp_user_id: 'goal-owner' };
    else if (endpoint.endsWith('/goals')) {
      if (route.request().method() === 'POST') {
        assert.equal(route.request().headers()['x-chapp-request'], '1');
        goals = { ...route.request().postDataJSON(), updated_at: '2026-11-04T12:00:00Z' };
        writes++;
      }
      result = route.request().method() === 'GET' ? { goals } : goals;
    } else if (endpoint.endsWith('/progress')) result = {
      as_of: '2026-11-04T12:00:00Z', total_attempts: 14, graded_attempts: 10,
      fully_correct_attempts: 8, ungraded_attempts: 4, average_correctness: .8,
      questions_needing_practice: 2, current_streak_days: 2, best_streak_days: 2,
      activity: Array.from({ length: 28 }, (_, i) => ({
        date: new Date(Date.UTC(2026, 9, 8 + i)).toISOString().slice(0, 10),
        attempts: i >= 26 ? 5 : 0, graded_attempts: i >= 26 ? 4 : 0,
        fully_correct_attempts: i >= 26 ? 3 : 0
      }))
    }; else throw new Error(endpoint);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
  });
  try {
    await page.goto(origin + '/progress');
    const panel = page.getByRole('region', { name: 'Weekly goals', exact: true });
    await panel.getByRole('button', { name: 'Set weekly goals' }).click();
    await panel.getByLabel('Practice days per week').fill('3');
    await panel.getByLabel('Submitted answers per week').fill('10');
    await panel.getByRole('button', { name: 'Save weekly goals' }).click();
    await panel.getByText('Your weekly goals are saved.').waitFor();
    assert.equal(writes, 1);
    assert.equal(await panel.getByRole('progressbar', { name: 'Submitted answers', exact: true }).getAttribute('value'), '10');
    assert.equal(await panel.getByRole('progressbar', { name: 'Practice days', exact: true }).getAttribute('value'), '2');
    await page.reload();
    await panel.getByRole('button', { name: 'Edit weekly goals' }).waitFor();
    assert.equal(writes, 1, 'Loading must not save goals');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await panel.screenshot({ path: (process.env.LEARNING_TEST_OUTPUT || require('os').tmpdir()) + '/weekly-goals-mobile.png' });
    assert.deepEqual(errors, []);
    console.log('Goals browser: explicit save, persisted reload, actual weekly counts, target completion, read-only viewing and mobile passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
