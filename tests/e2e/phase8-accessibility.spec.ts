import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

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

test('gestão: skip link, teclado e foco chegam ao conteúdo', async ({ page }) => {
  await page.goto('/?qa=institution-admin#overview');
  const skip = page.getByRole('link', { name: 'Pular para o conteúdo principal' });
  await skip.focus();
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#institutional-main-content$/);
});

test('login: zoom de 200% não cria overflow horizontal na viewport desktop mínima', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/?mode=student');
  await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
