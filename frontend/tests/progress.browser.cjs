const assert = require('assert/strict');
const { chromium } = require('playwright');
const origin = process.env.LEARNING_TEST_ORIGIN || 'http://127.0.0.1:3010';
const out = process.env.LEARNING_TEST_OUTPUT || require('os').tmpdir();
const path = require('path');
const activity = Array.from({ length: 28 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 9, 7 + index)).toISOString().slice(0, 10),
  attempts: index >= 25 ? 4 : 0,
  graded_attempts: index >= 25 ? index === 27 ? 4 : 2 : 0,
  fully_correct_attempts: index >= 25 ? index === 27 ? 3 : 1 : 0,
}));
const populated = {
  as_of: '2026-11-03T12:00:00Z', total_attempts: 12, graded_attempts: 8,
  fully_correct_attempts: 5, ungraded_attempts: 4, average_correctness: 0.75,
  questions_needing_practice: 2, current_streak_days: 3, best_streak_days: 5, activity,
};
let progress = populated;
let accountStatus = 200;
let progressStatus = 200;
let hold = null;
let progressReads = 0;
const calls = [];
const errors = [];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/chapbackend-api/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.replace('/chapbackend-api', '');
    calls.push({ endpoint, method: route.request().method() });
    let status = 200, body = {};
    if (endpoint === '/me') {
      status = accountStatus;
      body = { chapp_user_id: 'progress-owner' };
    } else if (endpoint === '/progress') {
      progressReads++;
      if (hold) await hold;
      status = progressStatus;
      body = progress;
    } else {
      throw new Error('Unexpected request from progress screen: ' + endpoint);
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const stat = label => page.locator('.stat-card').filter({ has: page.getByText(label, { exact: true }) });
  const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page must fit the viewport');
  try {
    let release;
    hold = new Promise(resolve => { release = resolve; });
    await page.goto(origin + '/progress');
    await page.getByRole('status').filter({ hasText: 'Loading your progress' }).waitFor();
    assert.equal(await page.locator('.stat-card').count(), 0, 'Loading must not show fabricated zero totals');
    hold = null;
    release();
    await page.getByText('Submitted attempts', { exact: true }).first().waitFor();
    assert.match(await stat('Submitted attempts').innerText(), /12/);
    assert.match(await stat('Average score').innerText(), /75%/);
    assert.match(await stat('Questions to revisit').innerText(), /2/);
    assert.match(await stat('Current streak').innerText(), /3/);
    await page.getByText('4 attempts have no completed grade.', { exact: false }).waitFor();
    assert.equal(await page.getByText('DEMO', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Words learned', { exact: true }).count(), 0);
    assert.match(await page.getByRole('img', { name: /^12 submitted attempts/ }).getAttribute('aria-label'), /last 7 days/);
    await page.getByLabel('Activity period').selectOption('28');
    await page.locator('summary').filter({ hasText: 'View daily counts' }).click();
    assert.equal(await page.locator('tbody tr').count(), 28);
    await noOverflow();
    await page.screenshot({ path: path.join(out, 'progress-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow();
    await page.screenshot({ path: path.join(out, 'progress-mobile.png'), fullPage: true });
    await page.goto(origin + '/');
    await page.getByRole('heading', { name: 'A little better, every day.' }).waitFor();
    await page.getByRole('button', { name: 'Refresh progress' }).waitFor();
    assert.equal(await page.getByText('DEMO', { exact: true }).count(), 0);
    assert.match(await stat('Average score').innerText(), /75%/);
    await page.getByText('these modes currently show demo content.', { exact: false }).waitFor();
    await noOverflow();
    await page.screenshot({ path: path.join(out, 'overview-mobile.png'), fullPage: true });

    progressStatus = 503;
    await page.getByRole('button', { name: 'Refresh progress' }).click();
    await page.getByRole('heading', { name: 'Progress is unavailable' }).waitFor();
    assert.equal(await page.locator('.stat-card').count(), 0);
    progressStatus = 200;
    progress = { ...populated, total_attempts: 0, graded_attempts: 0, fully_correct_attempts: 0, ungraded_attempts: 0, average_correctness: null, questions_needing_practice: 0, current_streak_days: 0, best_streak_days: 0, activity: activity.map(day => ({ ...day, attempts: 0, graded_attempts: 0, fully_correct_attempts: 0 })) };
    await page.getByRole('button', { name: 'Retry progress' }).click();
    await page.getByRole('heading', { name: 'Your first small step.' }).waitFor();
    assert.match(await stat('Average score').innerText(), /—/);
    assert.match(await stat('Submitted attempts').innerText(), /0/);

    progressStatus = 401;
    await page.getByRole('button', { name: 'Refresh progress' }).click();
    await page.getByRole('heading', { name: 'Progress is unavailable' }).waitFor();
    await page.getByRole('alert').filter({ hasText: 'Sign in to continue.' }).waitFor();
    progressStatus = 200;
    for (const [status, heading] of [[401, 'Your journey starts here.'], [403, 'Link your learner account']]) {
      accountStatus = status;
      const before = progressReads;
      await page.reload();
      await page.getByRole('heading', { name: heading }).waitFor();
      assert.equal(progressReads, before, 'Unauthenticated/unlinked accounts must not read progress');
      assert.equal(await page.locator('.stat-card').count(), 0);
    }
    accountStatus = 503;
    await page.reload();
    await page.getByRole('button', { name: 'Check account again' }).waitFor();
    accountStatus = 200;
    progress = populated;
    await page.getByRole('button', { name: 'Check account again' }).click();
    await page.getByRole('button', { name: 'Refresh progress' }).waitFor();
    assert.match(await stat('Average score').innerText(), /75%/);
    assert.equal(errors.length, 0, errors.join('\n'));
    assert.ok(calls.every(call => call.method === 'GET' && ['/me', '/progress'].includes(call.endpoint)), 'Viewing progress must never perform provider work or Anki refresh');
    console.log('Progress browser checks passed: live totals, loading, paging chart, refresh/recovery, empty state, auth, desktop/mobile, and read-only requests.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
