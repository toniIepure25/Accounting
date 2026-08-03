import { expect, test } from '@playwright/test';

/**
 * Prima experienta a unui client nou: dupa autentificare, aplicatia cere
 * configurarea initiala (datele firmei, identitate vizuala, licenta) inainte de
 * a intra in ecranele de lucru. Testul parcurge wizard-ul complet, ca sa
 * garanteze ca un client nou chiar poate ajunge in aplicatie cu datele lui.
 */
test('configurarea initiala salveaza datele firmei si deschide aplicatia', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Administrator' }).click();
  await page.getByRole('button', { name: 'Intra in aplicatie' }).click();

  await expect(page.getByRole('heading', { name: 'Bine ai venit' })).toBeVisible();

  // Pasul 1 — datele firmei
  await page.getByLabel('Denumire').fill('Fabrica E2E SRL');
  await page.getByLabel('Localitate').fill('Cluj-Napoca');
  await page.getByRole('button', { name: 'Continua' }).click();

  // Pasul 2 — identitate vizuala (optional, o lasam implicita)
  await expect(page.getByText('Identitate vizuala (optional)')).toBeVisible();
  await page.getByRole('button', { name: 'Continua' }).click();

  // Pasul 3 — licenta: fara cheie, continuam in evaluare pe editia Mobila
  await expect(page.getByLabel('Cheie de licenta')).toBeVisible();
  await page.getByRole('button', { name: 'Continua' }).click();

  // Pasul 4 — rezumat, apoi intram in aplicatie
  await expect(page.getByText('Totul e pregatit')).toBeVisible();
  await expect(page.getByText('Fabrica E2E SRL')).toBeVisible();
  await page.getByRole('button', { name: 'Intra in aplicatie' }).click();

  await expect(page.getByRole('heading', { name: 'Tablou de bord' })).toBeVisible();

  // Datele introduse in wizard au ajuns efectiv pe firma, nu doar in formular.
  // `exact` e necesar: hintul campului "Nume aplicatie afisat" contine si el
  // cuvantul "denumirea", deci o potrivire partiala ar prinde doua campuri.
  await page.getByRole('link', { name: 'Setari' }).click();
  await expect(page.getByLabel('Denumire', { exact: true })).toHaveValue('Fabrica E2E SRL');
});

test('configurarea initiala poate fi sarita', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Contabil' }).click();
  await page.getByRole('button', { name: 'Intra in aplicatie' }).click();

  await page.getByRole('button', { name: 'Sari peste configurare' }).click();
  await expect(page.getByRole('heading', { name: 'Tablou de bord' })).toBeVisible();
});
