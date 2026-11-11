import { test as base, expect, type Page } from "@playwright/test";
import { seedFinanceFixture, type FinanceFixture } from "./finance-fixtures";

// Authenticated finance flows. Each test gets its own isolated seller/admin/
// customer (see finance-fixtures.ts), so the assertions are about real FastAPI
// responses rather than about the seeded demo data. Runs against the local dev
// server (:3000) and the FastAPI finance backend (:8000) via the Next.js BFF.
// Defaults to the local dev server; CI/verification runs can point it at a
// production build (`next start -p 3100`) which does not compile on request.
const BASE = process.env.FINANCE_E2E_BASE_URL ?? "http://localhost:3000";
// Generous: this machine renders the seller shell (two Prisma aggregates)
// slowly enough that a 20s window is flaky on a cold server.
const VISIBLE = { timeout: 60000 };

type Fixtures = { finance: FinanceFixture };

const test = base.extend<Fixtures>({
  // Named `provide` (not `use`) so ESLint's react-hooks rule does not mistake
  // Playwright's fixture callback for a React hook.
  finance: async ({}, provide) => {
    const fixture = await seedFinanceFixture();
    try {
      await provide(fixture);
    } finally {
      await fixture.cleanup();
    }
  },
});

// The dev server compiles routes on demand and each page fans out to the BFF,
// so the default 30s per test is tight on a cold cache.
test.describe.configure({ timeout: 300_000 });

async function signIn(page: Page, token: string) {
  await page.context().addCookies([{ name: "cw_session", value: token, url: BASE }]);
}

function rowFor(page: Page, text: string) {
  return page.locator("tr", { hasText: text }).first();
}

test("seller finance loads real API data and shows only that seller's records", async ({ page, finance }) => {
  await signIn(page, finance.sellerToken);

  const statement = page.waitForResponse(
    (r) => r.url().includes("/api/seller/finance/statement") && r.request().method() === "GET",
  );
  const collections = page.waitForResponse((r) =>
    r.url().includes("/api/seller/finance/collections"),
  );

  await page.goto(`${BASE}/seller/finance`);
  await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible(VISIBLE);

  const statementResponse = await statement;
  expect(statementResponse.status()).toBe(200);
  const body = (await statementResponse.json()) as {
    sellerId: string;
    collections: { expectedCod: string; pendingCount: number };
  };
  expect(body.sellerId).toBe(finance.sellerId);
  expect(body.collections.expectedCod).toBe(finance.expectedAmount);
  expect(body.collections.pendingCount).toBe(1);

  const collectionsBody = (await (await collections).json()) as {
    collections: { sellerId: string; shipmentId: string }[];
  };
  expect(collectionsBody.collections.every((c) => c.sellerId === finance.sellerId)).toBe(true);
  expect(collectionsBody.collections.map((c) => c.shipmentId)).toContain(finance.shipmentId);
  expect(collectionsBody.collections.map((c) => c.shipmentId)).not.toContain(finance.otherShipmentId);

  await expect(rowFor(page, finance.shipmentId)).toBeVisible(VISIBLE);
  await expect(rowFor(page, `₹4,321.00`).first()).toBeVisible(VISIBLE);
  // Ownership isolation in the rendered page.
  await expect(page.getByText(finance.otherShipmentId)).toHaveCount(0);
});

test("seller confirms a COD collection through the real endpoint", async ({ page, finance }) => {
  await signIn(page, finance.sellerToken);
  await page.goto(`${BASE}/seller/finance`);

  const row = rowFor(page, finance.shipmentId);
  await expect(row).toBeVisible(VISIBLE);

  const confirmCall = page.waitForResponse(
    (r) => r.url().includes(`/api/seller/finance/collections/${finance.shipmentId}/confirm`) && r.request().method() === "POST",
  );
  await row.getByRole("button", { name: "Confirm" }).click();

  const response = await confirmCall;
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { status: string; collectedAmount: string; collectedBy: string };
  expect(body.status).toBe("confirmed");
  expect(body.collectedAmount).toBe(finance.expectedAmount);
  expect(body.collectedBy).toBe("seller");

  await expect(page.getByText("Collection confirmed.")).toBeVisible(VISIBLE);
  const confirmedRow = rowFor(page, finance.shipmentId);
  await expect(confirmedRow.getByText("Collected", { exact: true })).toBeVisible(VISIBLE);
  // The summary now counts it as confirmed and no discrepancy is raised.
  await expect(page.getByText(/1 collected/)).toBeVisible(VISIBLE);
  await expect(page.getByText("No discrepancies")).toBeVisible(VISIBLE);
});

test("seller finance surfaces a real backend failure instead of mock data", async ({ page, finance }) => {
  await signIn(page, finance.sellerToken);
  await page.route("**/api/seller/finance/statement", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "internal_error", message: "Statement service unavailable" } }),
    }),
  );

  await page.goto(`${BASE}/seller/finance`);
  await expect(page.getByText("Statement service unavailable")).toBeVisible(VISIBLE);
  await expect(page.getByRole("heading", { name: "COD collections" })).toHaveCount(0);
});

test("seller finance renders honest empty states", async ({ page, finance }) => {
  await signIn(page, finance.sellerToken);
  await page.route("**/api/seller/finance/statement", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sellerId: finance.sellerId,
        generatedAt: new Date().toISOString(),
        collections: {
          expectedCod: "0.00",
          confirmedCod: "0.00",
          pendingCount: 0,
          confirmedCount: 0,
          disputedCount: 0,
          discrepancyCount: 0,
          discrepancyAmount: "0.00",
        },
        commission: { assessed: "0.00", remitted: "0.00", outstanding: "0.00" },
        remittances: { received: "0.00", unallocated: "0.00", initiated: "0.00" },
        adjustments: { net: "0.00" },
        legacyEscrow: { held: "0.00", commission: "0.00", penalty: "0.00", refund: "0.00", released: "0.00", withdrawn: "0.00" },
      }),
    }),
  );
  await page.route("**/api/seller/finance/collections", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ collections: [] }) }),
  );
  await page.route("**/api/seller/finance/remittances", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ remittances: [] }) }),
  );
  await page.route("**/api/seller/finance/adjustments", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ adjustments: [] }) }),
  );

  await page.goto(`${BASE}/seller/finance`);
  await expect(page.getByText("No COD collections yet.")).toBeVisible(VISIBLE);
  await expect(page.getByText("No remittances yet.")).toBeVisible(VISIBLE);
  await expect(page.getByText("No adjustments yet.")).toBeVisible(VISIBLE);
  await expect(page.getByText("No discrepancies")).toBeVisible(VISIBLE);
});

test("admin finance lists real records across tabs and reaches the bulk assessment run", async ({ page, finance }) => {
  await signIn(page, finance.adminToken);

  const listCall = page.waitForResponse((r) => r.url().includes("/api/admin/finance/collections"));
  await page.goto(`${BASE}/admin/finance`);
  await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible(VISIBLE);
  expect((await listCall).status()).toBe(200);

  await page.getByRole("button", { name: "Collections" }).click();
  await expect(page.getByRole("heading", { name: "COD collections" })).toBeVisible(VISIBLE);
  await expect(page.getByText(finance.storeName)).toBeVisible(VISIBLE);
  await expect(page.getByText(finance.otherStoreName)).toBeVisible(VISIBLE);

  await page.getByRole("button", { name: "Commission" }).click();
  await expect(page.getByRole("heading", { name: "Commission policy" })).toBeVisible(VISIBLE);

  const runCall = page.waitForResponse(
    (r) => r.url().includes("/api/admin/finance/assessments/run") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Run assessments" }).click();
  const runResponse = await runCall;

  // The UI must report the server's actual answer: either a run summary, or the
  // fail-closed refusal when the environment has no active policy.
  if (runResponse.status() === 409) {
    const body = (await runResponse.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("policy_not_configured");
    await expect(page.getByText(body.error.message)).toBeVisible(VISIBLE);
  } else {
    expect(runResponse.status()).toBe(200);
    const body = (await runResponse.json()) as { created: number; skipped: number };
    await expect(page.getByText(/Assessed \d+ · already assessed \d+/)).toBeVisible(VISIBLE);
    expect(body.created + body.skipped).toBeGreaterThanOrEqual(0);
  }

  await page.getByRole("button", { name: "Adjustments" }).click();
  await expect(page.getByRole("heading", { name: "Seller adjustments & refunds" })).toBeVisible(VISIBLE);
  await page.getByRole("button", { name: "Remittances" }).click();
  await expect(page.getByRole("heading", { name: "Remittances", exact: true })).toBeVisible(VISIBLE);
});

test("admin finance refuses a seller session", async ({ page, finance }) => {
  await signIn(page, finance.sellerToken);
  await page.goto(`${BASE}/admin/finance`);
  // The admin layout shows an access notice for a signed-in non-admin (guest
  // sessions are redirected to /login — covered by finance-smoke.spec.ts).
  await expect(page.getByRole("heading", { name: "Administrator account required" })).toBeVisible(VISIBLE);
  await expect(page.locator("table")).toHaveCount(0);

  // The shell is UX only: the BFF still refuses the seller server-side.
  const response = await page.request.get(`${BASE}/api/admin/finance/collections`);
  expect(response.status()).toBe(403);
});

test("finance pages stay usable on a mobile viewport", async ({ page, finance }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, finance.sellerToken);
  await page.goto(`${BASE}/seller/finance`);
  await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible(VISIBLE);
  await expect(page.getByRole("navigation", { name: "Seller Hub mobile" })).toBeVisible(VISIBLE);
  // Measure after the tables have rendered: an in-flight first paint is not a
  // layout bug.
  await expect(rowFor(page, finance.shipmentId)).toBeVisible(VISIBLE);
  await expect(page.getByRole("heading", { name: "Remittance history" })).toBeVisible(VISIBLE);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.context().addCookies([{ name: "cw_session", value: finance.adminToken, url: BASE }]);
  await page.goto(`${BASE}/admin/finance`);
  await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible(VISIBLE);
  await page.getByRole("button", { name: "Commission" }).click();
  await expect(page.getByRole("heading", { name: "Commission policy" })).toBeVisible(VISIBLE);
  const adminOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(adminOverflow).toBeLessThanOrEqual(1);
});
