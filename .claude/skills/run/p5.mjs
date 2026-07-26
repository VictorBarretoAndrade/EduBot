// Plano 5 — smoke das 3 frentes (gestor, detalhe do aluno pelo professor, aluno).
//   node .claude/skills/run/p5.mjs <tutorToken> <studentToken> [outDir]
import { chromium } from 'playwright';

const tutorTok = process.argv[2];
const alunoTok = process.argv[3];
const outDir = process.argv[4] || '.';
if (!tutorTok || !alunoTok) { console.error('uso: node p5.mjs <tutorToken> <studentToken> [outDir]'); process.exit(1); }

const browser = await chromium.launch();
const base = 'http://localhost:8010/app/';

async function run(token, label) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.addInitScript((t) => {
    localStorage.setItem('token', t);
    localStorage.setItem('edubot.session', JSON.stringify({ student_id: 1, course_id: 1, is_admin: true }));
    // pula consentimento/onboarding para o smoke ir direto ao conteúdo
    localStorage.setItem('edubot.consent.v1', '1');
    localStorage.setItem('edubot.onboarding.v1', '1');
  }, token);
  return { ctx, page, errors, label };
}

const out = {};

// --- 1) GESTOR ---
{
  const { ctx, page, errors } = await run(tutorTok, 'gestor');
  await page.goto(base + '#/gestor', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/p5_gestor.png`, fullPage: true });
  out.gestor_heading = await page.locator('h1', { hasText: 'Visão do Gestor' }).count();
  out.gestor_catalogo = await page.getByText('O que o sistema rastreia').count();
  out.gestor_assunto = await page.getByText('Acertos e erros por assunto (turma)').count();
  out.gestor_errors = errors.slice();
  await ctx.close();
}

// --- 2) PROFESSOR -> clica aluno -> DETALHE ---
{
  const { ctx, page, errors } = await run(tutorTok, 'tutor');
  await page.goto(base + '#/tutor', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  // clica no primeiro botão "Ver desempenho de ..."
  const link = page.locator('button[aria-label^="Ver desempenho de"]').first();
  out.tutor_links = await page.locator('button[aria-label^="Ver desempenho de"]').count();
  await link.click();
  await page.waitForTimeout(2000);
  out.detalhe_hash = await page.evaluate(() => location.hash);
  out.detalhe_voltar = await page.getByText('Voltar para a turma').count();
  out.detalhe_assunto = await page.getByText('Acertos e erros por assunto').count();
  out.detalhe_comp = await page.getByText('Acertos e erros por competência').count();
  await page.screenshot({ path: `${outDir}/p5_detalhe_aluno.png`, fullPage: true });
  out.detalhe_errors = errors.slice();
  await ctx.close();
}

// --- 3) ALUNO -> Meu Desempenho -> por assunto ---
{
  const { ctx, page, errors } = await run(alunoTok, 'aluno');
  await page.goto(base + '#/evolution', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/p5_aluno.png`, fullPage: true });
  out.aluno_assunto = await page.getByText('Acertos e erros por assunto').count();
  out.aluno_comp = await page.getByText('Acertos e erros por competência').count();
  out.aluno_errors = errors.slice();
  await ctx.close();
}

console.log(JSON.stringify(out, null, 2));
await browser.close();
