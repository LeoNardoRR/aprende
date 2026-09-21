import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type CriticalSurface = {
  name: string;
  path: string;
  ready: (page: Page) => Promise<void>;
};

const surfaces: CriticalSurface[] = [
  {
    name: 'login-aluno',
    path: '/?mode=student',
    ready: async (page) => {
      await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible();
    },
  },
  {
    name: 'login-professor',
    path: '/?mode=teacher',
    ready: async (page) => {
      await expect(page.getByRole('heading', { name: 'Entrar como professor' })).toBeVisible();
    },
  },
  {
    name: 'login-gestao',
    path: '/?access=institutional',
    ready: async (page) => {
      await expect(page.getByRole('heading', { name: 'Entrar como gestor / equipe institucional' })).toBeVisible();
    },
  },
  {
    name: 'gestao',
    path: '/?qa=institution-admin#overview',
    ready: async (page) => {
      await expect(page.getByRole('heading', { name: /Olá,/ })).toBeVisible();
    },
  },
  {
    name: 'professor',
    path: '/?qa=teacher-dashboard',
    ready: async (page) => {
      await expect(page.getByRole('heading', { name: /Olá, Gabriel/i })).toBeVisible();
    },
  },
  {
    name: 'helpdesk',
    path: '/?qa=institution-admin#support',
    ready: async (page) => {
      await expect(page.locator('#support')).toBeVisible();
    },
  },
  {
    name: 'banco-de-itens',
    path: '/?qa=institution-admin#item-bank',
    ready: async (page) => {
      await expect(page.getByRole('heading', { name: /Banco de itens/i }).first()).toBeVisible();
    },
  },
  {
    name: 'avaliacao',
    path: '/?qa=institution-admin#assessments',
    ready: async (page) => {
      await expect(page.locator('#assessments')).toBeVisible();
    },
  },
  {
    name: 'analytics',
    path: '/?qa=institution-admin#analytics',
    ready: async (page) => {
      await expect(page.locator('#analytics')).toBeVisible();
    },
  },
  {
    name: 'jornadas',
    path: '/?qa=institution-admin#remediation',
    ready: async (page) => {
      await expect(page.locator('#remediation')).toBeVisible();
    },
  },
];

async function attachViolations(testInfo: TestInfo, violations: unknown) {
  await testInfo.attach('axe-violations.json', {
    body: Buffer.from(JSON.stringify(violations, null, 2)),
    contentType: 'application/json',
  });
}

for (const surface of surfaces) {
  test(`${surface.name}: zero violações críticas`, async ({ page }, testInfo) => {
    await page.goto(surface.path);
    await surface.ready(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    await attachViolations(testInfo, results.violations);
    expect(
      results.violations.filter((violation) => violation.impact === 'critical'),
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);
  });
}

test('aluno autenticado: zero violações críticas', async ({ page }, testInfo) => {
  const url = process.env.SUPABASE_URL;
  if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) {
    test.skip(true, 'Exige Supabase local descartável.');
    return;
  }
  const fixture = JSON.parse(await readFile(path.resolve('artifacts/poc/seed-manifest.json'), 'utf8'));
  expect(fixture.synthetic).toBe(true);
  await page.goto('/?mode=student');
  await page.getByLabel('E-mail').fill(fixture.users.student1);
  await page.getByLabel('Senha').fill(process.env.POC_DEMO_PASSWORD || 'AprendePocLocal!2026');
  await page.locator('form').getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#student-main-content')).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  await attachViolations(testInfo, results.violations);
  expect(
    results.violations.filter((violation) => violation.impact === 'critical'),
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
});

test('impressão e importação: zero violações críticas', async ({ page }, testInfo) => {
  await page.goto('/?qa=institution-admin#assessments');
  await page.getByRole('tab', { name: 'Impressão' }).click();
  await expect(page.getByRole('heading', { name: 'Aplicação impressa' })).toBeVisible();
  await page.getByRole('tab', { name: 'Aplicações' }).click();
  await expect(page.getByRole('heading', { name: 'Importar respostas offline' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await attachViolations(testInfo, results.violations);
  expect(results.violations.filter((violation) => violation.impact === 'critical')).toEqual([]);
});

test('privacidade do professor: zero violações críticas', async ({ page }, testInfo) => {
  await page.goto('/?qa=teacher-dashboard');
  await page.getByRole('button', { name: 'Configurações' }).click();
  await expect(page.getByRole('heading', { name: 'Privacidade e meus dados' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await attachViolations(testInfo, results.violations);
  expect(results.violations.filter((violation) => violation.impact === 'critical')).toEqual([]);
});

test('gestão: skip link, teclado e foco chegam ao conteúdo', async ({ page }) => {
  await page.goto('/?qa=institution-admin#overview');
  const skip = page.getByRole('link', { name: 'Pular para o conteúdo principal' });
  await skip.focus();
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#institutional-main-content$/);
});

test('login: matriz de zoom Desktop não cria overflow horizontal', async ({ page }) => {
  for (const width of [1024, 1280, 1366, 1440, 1600, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?mode=student');
    await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible();
    for (const zoom of [1, 1.25, 1.5, 2]) {
      await page.evaluate((value) => { document.documentElement.style.zoom = String(value); }, zoom);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${width}px em ${zoom * 100}%`).toBeLessThanOrEqual(1);
    }
  }
});
