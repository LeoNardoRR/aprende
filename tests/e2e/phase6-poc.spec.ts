import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { loadMatrix, summarize } from '../../scripts/poc-matrix.mjs';

test('administrador consulta a matriz real e filtra bloqueadores da PoC', async ({ page }) => {
  const matrix = await loadMatrix() as {
    metadata: { base_commit: string };
    requirements: Array<{ id: string; severity: string; status: string; gap: string }>;
  };
  const summary = summarize(matrix);
  await page.goto('/?qa=institution-admin#poc');
  await expect(page.getByRole('heading', { name: 'Control Center da PoC' })).toBeVisible();
  await expect(page.getByText(matrix.metadata.base_commit.slice(0, 8), { exact: true })).toBeVisible();
  await expect(page.getByText(`${summary.conformity.toFixed(1).replace('.', ',')}%`, { exact: true })).toBeVisible();
  await expect(page.locator('.poc-requirement')).toHaveCount(summary.total);
  const filters = page.locator('.poc-filters');
  await filters.getByLabel('Severidade').selectOption('P0');
  await expect(page.locator('.poc-requirement')).toHaveCount(matrix.requirements.filter((item) => item.severity === 'P0').length);
  await filters.getByLabel('Status').selectOption('NAO_ATENDIDO');
  await expect(page.locator('.poc-requirement')).toHaveCount(matrix.requirements.filter((item) => item.severity === 'P0' && item.status === 'NAO_ATENDIDO').length);
  await filters.getByLabel('Status').selectOption('PARCIAL');
  const vaar = page.locator('.poc-requirement').filter({ hasText: 'VAAR e equidade' });
  await vaar.getByText('POC-1.10', { exact: true }).click();
  await expect(vaar.getByText(matrix.requirements.find((item) => item.id === 'POC-1.10')!.gap)).toBeVisible();
  const destination = path.resolve('artifacts/poc/security/control-center-p0.png');
  await mkdir(path.dirname(destination), { recursive: true });
  await page.screenshot({ path: destination, fullPage: true });
});
