import { expect, test } from '@playwright/test';

test('creaza o proforma noua (ciorna) cu o linie de produs', async ({ page }) => {
  // Sarim configurarea initiala: aici verificam fluxul de documente.
  await page.addInitScript(() => localStorage.setItem('gr-configurare-initiala', 'da'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Administrator' }).click();
  await page.getByRole('button', { name: 'Intra in aplicatie' }).click();
  await expect(page.getByRole('heading', { name: 'Tablou de bord' })).toBeVisible();

  await page.getByRole('link', { name: 'Proforme' }).click();
  await page.getByRole('button', { name: 'Document nou' }).click();

  await page.getByLabel('Client').selectOption({ label: 'Restaurant Boema SRL' });
  await page.getByRole('button', { name: 'Adauga linie' }).click();
  await page.locator('table select').selectOption({ label: 'DULAP · Dulap clasic (la comanda)' });
  await page.getByRole('button', { name: 'Salveaza ciorna' }).click();

  const row = page.locator('tr', { hasText: 'Restaurant Boema SRL' });
  await expect(row).toBeVisible();
  // DULAP (500,00 RON, 'standard') cu cota rezolvata la data documentului: 21%
  // de la 01.08.2025 => 605,00 (inainte era 19% hardcodat = 595,00).
  await expect(row.getByText('605,00')).toBeVisible();
  await expect(row.getByText('ciorna')).toBeVisible();
});
