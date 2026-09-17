import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const password = process.env.POC_DEMO_PASSWORD || 'AprendePocLocal!2026';
const local = (target?: string) => { try { return ['localhost','127.0.0.1'].includes(new URL(target ?? '').hostname); } catch { return false; } };

test('analytics leva à jornada, aluno progride e professor acompanha', async ({ page }) => {
  test.skip(!local(url) || !anonKey, 'E2E Fase 7 exige Supabase local descartável.');
  const base = JSON.parse(await readFile(path.resolve('artifacts/poc/seed-manifest.json'), 'utf8'));
  const phase7 = JSON.parse(await readFile(path.resolve('artifacts/poc/phase7-seed-manifest.json'), 'utf8'));
  expect(base.synthetic).toBe(true); expect(phase7.synthetic).toBe(true);

  await page.goto('/?mode=teacher');
  await page.getByLabel('E-mail').fill(base.users.teacher1);
  await page.getByLabel('Senha').fill(password);
  await page.locator('form').getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Olá,/ })).toBeVisible();
  await page.getByRole('button', { name: 'Notas' }).click();
  const skillRow = page.locator('.analytics-table-card tr').filter({ hasText: phase7.skill_code }).filter({ has: page.getByRole('button', { name: 'Atribuir jornada' }) });
  await expect(skillRow).toBeVisible();
  await skillRow.getByRole('button', { name: 'Atribuir jornada' }).click();
  await expect(page.getByRole('heading', { name: 'Recomposição da turma' })).toBeVisible();
  await expect(page.getByRole('option', { name: /Reconstruindo estratégias/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Atribuir à turma' }).click();
  await expect(page.getByText('Jornada atribuída. Os estudantes já podem iniciar.')).toBeVisible();

  await page.goto('/?mode=student');
  await page.getByLabel('E-mail').fill(base.users.student1);
  await page.getByLabel('Senha').fill(password);
  await page.locator('form').getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Minha jornada de aprendizagem' })).toBeVisible();
  const journey = page.locator('.pedagogy-student');
  await journey.locator('.pedagogy-steps li').first().getByRole('button', { name: 'Concluir etapa' }).click();
  await expect(journey.locator('.pedagogy-steps li').first().getByRole('button', { name: 'Concluída' })).toBeVisible();
  await journey.getByRole('radio', { name: '20 + 10 + 7 + 5' }).check();
  await journey.getByRole('button', { name: 'Concluir etapa' }).click();
  await expect(page.getByText('Progresso salvo com segurança.')).toBeVisible();

  const teacher = createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await teacher.auth.signInWithPassword({ email: base.users.teacher1, password });
  expect(signedIn.error).toBeNull();
  const dashboard = await teacher.rpc('get_pedagogical_dashboard', { filters: { classroom_id: base.classroom_ids[0] } });
  expect(dashboard.error).toBeNull();
  expect(Number(dashboard.data.summary.in_progress)).toBeGreaterThan(0);
  await mkdir('artifacts/poc/pedagogy', { recursive: true });
  await page.screenshot({ path: 'artifacts/poc/pedagogy/phase7-learning-journey.png', fullPage: true });
});

test('prévia mantém leitura e ações acessíveis em viewport móvel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?qa=institution-admin#remediation');
  await page.getByRole('link', { name: 'Recomposição' }).click();
  await expect(page.getByRole('heading', { name: 'Jornadas e intervenções' })).toBeVisible();
  await expect(page.getByText('DEMO visual · dados sintéticos identificados.')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const hub = document.getElementById('remediation');
    const bounds = hub?.getBoundingClientRect();
    return Boolean(hub && bounds && hub.scrollWidth <= hub.clientWidth && bounds.left >= 0 && bounds.right <= window.innerWidth);
  })).toBe(true);
});
