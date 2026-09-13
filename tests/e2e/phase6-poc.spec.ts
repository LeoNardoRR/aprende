import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test('administrador consulta a matriz real e filtra bloqueadores da PoC', async ({ page }) => {
  await page.goto('/?qa=institution-admin#poc');
  await expect(page.getByRole('heading', { name: 'Control Center da PoC' })).toBeVisible();
  await expect(page.getByText('89b336ab', { exact: true })).toBeVisible();
  await expect(page.getByText('47,2%', { exact: true })).toBeVisible();
  await expect(page.locator('.poc-requirement')).toHaveCount(21);
  const filters = page.locator('.poc-filters');
  await filters.getByLabel('Severidade').selectOption('P0');
  await expect(page.locator('.poc-requirement')).toHaveCount(12);
  await filters.getByLabel('Status').selectOption('NAO_ATENDIDO');
  await expect(page.locator('.poc-requirement')).toHaveCount(5);
  const vaar = page.locator('.poc-requirement').filter({ hasText: 'VAAR e equidade' });
  await vaar.getByText('POC-1.10', { exact: true }).click();
  await expect(vaar.getByText('Dominio VAAR/equidade nao foi implementado.')).toBeVisible();
  const destination = path.resolve('artifacts/poc/security/control-center-p0.png');
  await mkdir(path.dirname(destination), { recursive: true });
  await page.screenshot({ path: destination, fullPage: true });
});
