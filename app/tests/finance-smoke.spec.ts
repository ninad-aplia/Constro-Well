import { test, expect, type Page } from '@playwright/test';

// WP-1B browser smoke test — runs against the local server (:3000) and the
// FastAPI finance backend (:8000, reached via the Next.js BFF). Uses the seeded
// demo accounts (password: constrowell-demo).
const BASE = process.env.FINANCE_E2E_BASE_URL ?? 'http://localhost:3000';
const VISIBLE = { timeout: 20000 };
const NAV = { timeout: 60000 };

// This machine needs a long budget for a cold render (see finance-flows.spec.ts).
test.describe.configure({ timeout: 120_000 });

async function goto(page: Page, path: string) {
  // `load` waits on every chunk; the app is usable at domcontentloaded.
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: NAV.timeout });
}

async function login(page: Page, email: string) {
  await goto(page, '/login');
  // Clicking before React attaches would fall back to a native form submit, so
  // wait for the hydrated props instead of racing the bundle.
  await page.waitForFunction(
    () => {
      const input = document.querySelector('#login_email');
      if (!input) return false;
      return Object.keys(input).some((key) => key.startsWith('__reactProps$'));
    },
    undefined,
    NAV,
  );
  await page.fill('#login_email', email);
  await page.fill('#login_password', 'constrowell-demo');
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
    NAV,
  );
  await page.getByRole('button', { name: 'Sign in' }).click();
  expect((await responsePromise).status()).toBe(200);
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), NAV);
}

test('seller finance page renders authenticated', async ({ page }) => {
  await login(page, 'bharat.build.mart@demo.constrowell.test');
  await goto(page, '/seller/finance');
  await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible(VISIBLE);
  await expect(page.getByRole('heading', { name: 'COD collections' })).toBeVisible(VISIBLE);
  await expect(page.getByRole('heading', { name: 'Remittance history' })).toBeVisible(VISIBLE);
});

test('seller legacy escrow page is relabelled', async ({ page }) => {
  await login(page, 'bharat.build.mart@demo.constrowell.test');
  await goto(page, '/seller/payments');
  await expect(page.getByRole('heading', { name: 'Legacy escrow', exact: true })).toBeVisible(VISIBLE);
  await expect(page.getByText('pre-cutover', { exact: false }).first()).toBeVisible(VISIBLE);
});

test('admin finance page renders authenticated', async ({ page }) => {
  await login(page, 'constro.well.admin@demo.constrowell.test');
  await goto(page, '/admin/finance');
  await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible(VISIBLE);
  await expect(page.getByRole('button', { name: 'Remittances' })).toBeVisible(VISIBLE);
});

test('unauthenticated finance pages redirect to login', async ({ page }) => {
  await goto(page, '/seller/finance');
  await page.waitForURL(/\/login/, NAV);
  await goto(page, '/admin/finance');
  await page.waitForURL(/\/login/, NAV);
});

test('seller finance page renders on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'bharat.build.mart@demo.constrowell.test');
  await goto(page, '/seller/finance');
  await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible(VISIBLE);
  // The mobile bottom nav is present.
  await expect(page.getByRole('navigation', { name: 'Seller Hub mobile' })).toBeVisible(VISIBLE);
});
