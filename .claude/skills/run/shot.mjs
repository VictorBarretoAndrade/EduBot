// Driver Playwright do EduBot: injeta a sessão do aluno (pula o login), captura
// o dashboard autenticado e navega para o quiz via hash routing.
//
//   npm i playwright && npx playwright install chromium
//   TOKEN=$(curl -s -X POST http://localhost:5010/login -H "Content-Type: application/json" \
//     -d '{"ra":"1","password":"1"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")
//   node .claude/skills/run/shot.mjs "$TOKEN" .
import { chromium } from 'playwright';

const token = process.argv[2];
const outDir = process.argv[3] || '.';
if (!token) { console.error('uso: node shot.mjs <token> [outDir]'); process.exit(1); }
const session = JSON.stringify({ student_id: 1, course_id: 1, is_admin: false });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.addInitScript(([t, s]) => {
  localStorage.setItem('token', t);
  localStorage.setItem('edubot.session', s);
}, [token, session]);

await page.goto('http://localhost:8010/app/#/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const title = await page.title();
await page.screenshot({ path: `${outDir}/dashboard.png`, fullPage: true });

await page.goto('http://localhost:8010/app/#/quiz', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/quiz.png` });
const hashAfter = await page.evaluate(() => location.hash);

console.log('TITLE:', title);
console.log('HASH_AFTER_NAV:', hashAfter);
console.log('CONSOLE_ERRORS:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
