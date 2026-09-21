import { expect, test, type Locator, type Page } from '@playwright/test';

const widths = [1024, 1280, 1366, 1440, 1600, 1920] as const;

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function stableScreenshot(locator: Locator, name: string) {
  await expect(locator).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.015,
  });
}

async function stablePageScreenshot(page: Page, name: string) {
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maxDiffPixelRatio: 0.015,
  });
}

for (const width of widths) {
  test(`shell de gestão sem overflow em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?qa=institution-admin#overview');
    await expect(page.getByRole('heading', { name: /Olá,/ })).toBeVisible();
    await expectNoPageOverflow(page);
    await stablePageScreenshot(page, `gestao-${width}.png`);
  });
}

const criticalSections = [
  ['banco-de-itens', '#curricula'],
  ['avaliacao', '#assessments'],
  ['analytics', '#analytics'],
  ['jornadas', '#remediation'],
  ['helpdesk', '#support'],
] as const;

for (const [name, selector] of criticalSections) {
  test(`${name}: seção crítica estável`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?qa=institution-admin${selector}`);
    const section = page.locator(selector);
    await expect(section).toBeVisible();
    if (name === 'helpdesk') {
      await expect(section.locator('.operations-workspace')).toHaveCSS('display', 'grid');
      await expect(section.locator('.operations-primary')).toHaveCSS('display', 'flex');
    }
    await expectNoPageOverflow(page);
    await stableScreenshot(section, `${name}-1440.png`);
  });
}

test('professor: shell desktop estável em 1440px', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(new Date('2026-09-20T12:00:00-03:00'));
  await page.goto('/?qa=teacher-dashboard');
  await expect(page.getByRole('heading', { name: /Olá, Gabriel/i })).toBeVisible();
  await expectNoPageOverflow(page);
  await stablePageScreenshot(page, 'professor-1440.png');
});

for (const [name, path, heading] of [
  ['login-aluno', '/?mode=student', 'Entre na sua conta'],
  ['login-professor', '/?mode=teacher', 'Entrar como professor'],
  ['login-gestao', '/?access=institutional', 'Entrar como gestor / equipe institucional'],
] as const) {
  test(`${name}: formulário estável`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expectNoPageOverflow(page);
    await stableScreenshot(page.locator('main, [role="main"]').first(), `${name}-1440.png`);
  });
}
