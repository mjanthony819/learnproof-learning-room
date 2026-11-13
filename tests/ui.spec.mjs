/* LearnProof live-UI checks with Playwright + system Chrome. Usage:
   node tests/ui.spec.mjs [baseURL]
   Default baseURL is http://127.0.0.1:8377 (serve the repo root first).
   The same script runs against the deployed GitHub Pages URL. */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const axeSource = require('axe-core').source;

const BASE = process.argv[2] || 'http://127.0.0.1:8377/';
let passed = 0, failed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { passed++; console.log('PASS', name); }
  else { failed++; failures.push(name + (detail ? ' :: ' + detail : '')); console.log('FAIL', name, detail || ''); }
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

async function noHOverflow(name) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(name + ': no horizontal overflow', r.sw <= r.cw + 1, `scrollWidth ${r.sw} > ${r.cw}`);
}
async function axe(name) {
  await page.evaluate(axeSource);
  const res = await page.evaluate(async () => await axe.run(document, { resultTypes: ['violations'] }));
  const serious = res.violations.filter(v => ['serious', 'critical'].includes(v.impact));
  check('axe: ' + name, serious.length === 0, serious.map(v => v.id + ':' + v.nodes.length).join(', '));
}
async function answerCurrentUnknown() {
  await page.evaluate(() => {
    const radios = [...document.querySelectorAll('input[name=answer]')];
    radios[radios.length - 1].click();
  });
  await page.click('[data-action=next]');
  await page.waitForTimeout(30);
}
async function answerCurrentCorrect(L, stage) {
  await page.evaluate(([L, stage]) => {
    const packs = JSON.parse(document.getElementById('lesson-data').textContent);
    const lesson = packs.find(p => p.id === L);
    // find current index from progress bar
    const bar = document.querySelector('.progress');
    const now = Number(bar.getAttribute('aria-valuenow')) - 1;
    const q = lesson[stage][now];
    const radios = [...document.querySelectorAll('input[name=answer]')];
    radios[q.correct].click();
  }, [L, stage]);
  await page.click('[data-action=next]');
  await page.waitForTimeout(30);
}

/* ---------- 1. library ---------- */
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForSelector('.lesson-card');
check('library shows 4 lesson cards', await page.locator('.lesson-card').count() === 4);
check('library brands LearnProof', (await page.textContent('header')).includes('learnproof'));
check('no console errors on library', errors.length === 0, errors.join(' | '));
await noHOverflow('library 1280');
await axe('library');

/* ---------- 2. full deadlock room flow ---------- */
await page.click('[data-room="deadlock-v2"]');
await page.waitForSelector('.hero');
check('room home renders', (await page.textContent('#main')).includes('Deadlocks'));
check('hash routing set', page.url().includes('#/room/deadlock-v2'));
// diagnostic: all unknown
await page.click('[data-action=start]');
await page.waitForSelector('.question');
for (let i = 0; i < 6; i++) await answerCurrentUnknown();
await page.waitForSelector('.reading');
check('learn path after diagnostic', (await page.textContent('#main')).includes('TARGETED LEARNING PATH'));
check('path shows 3 concepts', await page.locator('section.concept').count() === 3);
// lab: change cycle to chain, predict no, reveal
await page.click('[data-action=lab]');
await page.waitForSelector('.lab-grid');
await page.selectOption('#preset', 'chain');
await page.waitForTimeout(60);
await page.click('[data-predict=no]');
await page.click('[data-action=reveal-lab]');
await page.waitForSelector('.status');
check('deadlock lab chain has a way through', (await page.textContent('.status')).includes('way through'));
// practice: all correct via pack data
await page.click('[data-action=practice]');
await page.waitForSelector('.question');
for (let i = 0; i < 3; i++) await answerCurrentCorrect('deadlock-v2', 'practice');
await page.waitForSelector('.evidence', { timeout: 3000 }).catch(() => {});
check('feedback after practice', (await page.textContent('#main')).includes('REFLECT'));
// fresh check: all correct
await page.click('[data-action=post]');
await page.waitForSelector('.question');
for (let i = 0; i < 6; i++) await answerCurrentCorrect('deadlock-v2', 'post');
await page.waitForSelector('.scores');
const reportText = await page.textContent('#main');
check('report shows 0/6 → 6/6', reportText.includes('0 / 6') && reportText.includes('6 / 6'));
check('report shows +100 points', reportText.includes('+100.0 percentage points') || reportText.includes('+100 percentage points'));
check('report keeps honesty note', reportText.includes('does not prove lasting mastery'));
check('ics reminder button present', await page.locator('[data-action=ics]').count() === 1);
await noHOverflow('report 1280');
await axe('report');
// recall set
await page.click('[data-action=recall]');
await page.waitForSelector('.question');
for (let i = 0; i < 6; i++) await answerCurrentUnknown();
await page.waitForSelector('.scores');
check('recall evidence recorded', (await page.textContent('#main')).includes('Recall self-check'));

/* ---------- 3. evidence export + restore ---------- */
const dl = await Promise.all([
  page.waitForEvent('download'),
  page.click('[data-action=export]'),
]).then(([d]) => d).catch(() => null);
check('evidence JSON downloads', !!dl);
let reportPath = null;
if (dl) { reportPath = await dl.path(); }
if (reportPath) {
  const fs = await import('node:fs');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  check('report format + lesson id', report.format === 'LearnProof evidence' && report.lessonId === 'deadlock-v2');
  // wipe session, restore from report
  await page.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
  await page.goto('about:blank');
  await page.goto(BASE + '#/room/deadlock-v2');
  await page.waitForSelector('.hero');
  await page.setInputFiles('#import', reportPath);
  await page.waitForTimeout(300);
  const restored = await page.textContent('#main');
  check('restored report renders scores', restored.includes('6 / 6'));
  check('restored report is flagged', restored.includes('Restored from an editable local report'));
}

/* ---------- 4. my learning aggregation ---------- */
await page.goto(BASE + '#/my');
await page.waitForSelector('.path-row');
const myText = await page.textContent('#main');
check('my learning lists all rooms', await page.locator('.path-row').count() === 4);
check('my learning shows deadlock scores', myText.includes('fresh 6/6'));
await axe('my learning');

/* ---------- 5. scheduling lab ---------- */
await page.goto(BASE + '#/room/cpu-scheduling-v1');
await page.waitForSelector('.hero');
await page.click('[data-action=lab]');
await page.waitForSelector('.lab-grid');
await page.fill('#predict-wait', '17');
await page.click('[data-action=reveal-lab]');
await page.waitForSelector('.status');
check('scheduling lab computes FCFS convoy 17', (await page.textContent('.status')).includes('17'));
check('scheduling lab verdict confirms prediction', (await page.textContent('.lab-output')).includes('matches the simulation'));
await page.selectOption('#policy', 'sjf');
await page.waitForTimeout(60);
await page.click('[data-action=reveal-lab]');
await page.waitForSelector('.status');
check('scheduling lab SJF gives 3', (await page.textContent('.status')).includes('3'));
check('scheduling lab surprises the FCFS guess', (await page.textContent('.lab-output')).includes('Trace the slices'));
await noHOverflow('scheduling lab 1280');

/* ---------- 6. paging lab ---------- */
await page.goto(BASE + '#/room/paging-v1');
await page.waitForSelector('.hero');
await page.click('[data-action=lab]');
await page.waitForSelector('.lab-grid');
await page.fill('#predict-faults', '9');
await page.click('[data-action=reveal-lab]');
await page.waitForSelector('.status');
check('paging lab FIFO classic = 9 faults', (await page.textContent('.status')).includes('9 faults'));
await page.selectOption('#policy', 'opt');
await page.waitForTimeout(60);
await page.click('[data-action=reveal-lab]');
await page.waitForSelector('.status');
check('paging lab OPT = 7 faults', (await page.textContent('.status')).includes('7 faults'));

/* ---------- 7. transactions lab ---------- */
await page.goto(BASE + '#/room/transactions-v1');
await page.waitForSelector('.hero');
await page.click('[data-action=lab]');
await page.waitForSelector('.lab-grid');
await page.click('[data-predict=no]');
await page.click('[data-action=reveal-lab]');
await page.waitForSelector('.status');
check('transactions lab finds the cycle', (await page.textContent('.status')).includes('no serial equivalent'));
check('transactions lab lists conflicts', await page.locator('.lab-output .edge').count() === 2);
// remove the last op -> acyclic
await page.click('[data-remove-op="3"]');
await page.waitForTimeout(60);
await page.click('[data-action=reveal-lab]');
await page.waitForSelector('.status');
check('transactions lab serial order after fix', (await page.textContent('.lab-output')).includes('equivalent serial order'));

/* ---------- 8. display & access ---------- */
await page.goto(BASE + '#/access');
await page.waitForSelector('.reading');
await page.click('[data-size=larger]');
check('text size larger applies', await page.evaluate(() => document.body.classList.contains('fs-larger')));
await page.click('[data-font=alt]');
check('alt typeface applies', await page.evaluate(() => document.body.classList.contains('font-alt')));
check('dyslexia claim is honest', /research on specialised typefaces is mixed/i.test(await page.textContent('#main')));
const accessText = await page.textContent('#main');
check('read-aloud privacy caveat present', accessText.includes('may send text to a network service'));
await axe('access view');
await page.click('[data-size=standard]');
await page.click('[data-font=default]');

/* ---------- 9. persistence + remember ---------- */
await page.goto(BASE + '#/');
await page.waitForSelector('.lesson-card');
check('library shows deadlock done', (await page.textContent('#main')).includes('Evidence complete'));
// sessionStorage survives reload
await page.reload();
await page.waitForSelector('.lesson-card');
check('progress survives reload in tab', (await page.textContent('#main')).includes('Evidence complete'));
// enable remember, new context reads localStorage
await page.evaluate(() => document.getElementById('remember').click());
await page.waitForTimeout(120);
const stored = await page.evaluate(() => !!localStorage.getItem('lp3'));
check('remember opt-in writes localStorage', stored);

/* ---------- 10. mobile 390px ---------- */
const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mob.newPage();
await mpage.goto(BASE, { waitUntil: 'load' });
await mpage.waitForSelector('.lesson-card');
const mOver = async (name) => {
  const r = await mpage.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(name + ': no horizontal overflow (390px)', r.sw <= r.cw + 1, `scrollWidth ${r.sw}`);
};
await mOver('library');
await mpage.goto(BASE + '#/room/deadlock-v2');
await mpage.waitForSelector('.hero');
await mOver('room home');
await mpage.goto(BASE + '#/room/cpu-scheduling-v1');
await mpage.waitForSelector('.hero');
await mpage.click('[data-action=lab]');
await mpage.waitForSelector('.lab-grid');
await mpage.fill('#predict-wait', '17');
await mpage.click('[data-action=reveal-lab]');
await mpage.waitForSelector('.status');
await mOver('scheduling lab revealed');
await mpage.goto(BASE + '#/my');
await mpage.waitForSelector('.path-row');
await mOver('my learning');
await mob.close();

/* ---------- 11. offline copy ---------- */
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForSelector('.lesson-card');
const fs2 = await import('node:fs');
const offlineExists = fs2.existsSync(new URL('../learnproof-offline.html', import.meta.url).pathname);
if (offlineExists) {
  const opage = await ctx.newPage();
  const res = await opage.goto('file://' + new URL('../learnproof-offline.html', import.meta.url).pathname);
  await opage.waitForSelector('.lesson-card');
  check('offline copy runs from file://', await opage.locator('.lesson-card').count() === 4);
  const oerr = [];
  opage.on('pageerror', e => oerr.push(String(e)));
  await opage.click('[data-room="paging-v1"]');
  await opage.waitForSelector('.hero');
  check('offline room navigation works', (await opage.textContent('#main')).includes('Paging'));
  check('offline copy has no page errors', oerr.length === 0, oerr.join('|'));
  await opage.close();
} else {
  check('offline copy exists', false);
}

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) { console.log('FAILURES:\n' + failures.join('\n')); process.exit(1); }
