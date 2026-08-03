import { expect, test } from '@playwright/test';

test('autentificare in mod demo (fara parola) deschide aplicatia', async ({ page }) => {
  // Marcam configurarea initiala ca facuta: acest test verifica autentificarea,
  // nu wizard-ul de prima pornire (acoperit separat in configurare-initiala.spec.ts).
  await page.addInitScript(() => localStorage.setItem('gr-configurare-initiala', 'da'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Autentificare' })).toBeVisible();

  await page.getByRole('button', { name: 'Contabil' }).click();
  await page.getByRole('button', { name: 'Intra in aplicatie' }).click();

  await expect(page.getByRole('heading', { name: 'Tablou de bord' })).toBeVisible();
  // Sidebar-ul confirma ca sesiunea + firma demo s-au incarcat. Cu 2+ firme in
  // seed, Sidebar-ul randeaza un <select> (nu doar text) — verificam valoarea
  // selectata, nu vizibilitatea unui <option> (native, ascuns de Playwright).
  const F_TITAN_ID = 'a0000000-0000-4000-8000-000000000000';
  await expect(page.locator('aside select')).toHaveValue(F_TITAN_ID);
});
