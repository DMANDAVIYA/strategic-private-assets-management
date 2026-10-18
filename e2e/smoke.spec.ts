import { expect, test, type Browser, type BrowserContext, type Locator, type Page, type Response } from "@playwright/test";

const ACCOUNT = { email: "smoke@example.test", displayName: "Smoke", password: "correct-horse-battery" };
const WRONG_PASSWORD = "not-the-password";
const ALLOWED_HOST = "127.0.0.1";
const FAILURES_BEFORE_LOCK = 5;
const WRONG_PASSWORD_MESSAGE = "Email or password is wrong.";
const LOCKED_MESSAGE = /^Too many attempts\. Try again at /;

async function submitLogin(page: Page, password: string, trustDevice: boolean): Promise<Response> {
  await page.getByLabel("Email").fill(ACCOUNT.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Trust this device for 30 days").setChecked(trustDevice);
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/auth/login")),
    page.getByRole("button", { name: "Log in" }).click(),
  ]);
  return response;
}

async function logOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `page is ${overflow}px wider than the viewport`).toBeLessThanOrEqual(0);
}

function loginAlert(page: Page): Locator {
  return page.getByRole("alert");
}

function offOriginUrls(urls: ReadonlyArray<string>): string[] {
  return urls.filter((url) => new URL(url).hostname !== ALLOWED_HOST);
}

test.describe("smoke flow", () => {
  test.describe.configure({ mode: "serial" });

  let context: BrowserContext;
  let page: Page;
  const requestedUrls: string[] = [];

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    page.on("request", (request) => {
      requestedUrls.push(request.url());
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("first visit redirects to setup and creating the account lands on the overview", async () => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/setup$/);
    await page.getByLabel("Email").fill(ACCOUNT.email);
    await page.getByLabel("Display name").fill(ACCOUNT.displayName);
    await page.getByLabel("Password", { exact: true }).fill(ACCOUNT.password);
    await page.getByLabel("Confirm password").fill(ACCOUNT.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Nothing to show yet" })).toBeVisible();
    await expect(page.getByText(ACCOUNT.displayName, { exact: true })).toBeVisible();
  });

  test("access page renders the phone address with a loaded QR code or the no-address notice", async () => {
    await page.goto("/settings/access");
    const phonePanel = page.locator("section", { has: page.getByRole("heading", { name: "Open on your phone" }) });
    await expect(phonePanel).toBeVisible();
    const address = phonePanel.getByText(/^https?:\/\//);
    const noAddress = phonePanel.getByText("No network address found.");
    await expect(address.or(noAddress)).toBeVisible();
    if (await noAddress.isVisible()) {
      await expect(address).toHaveCount(0);
      await expect(phonePanel.getByRole("img")).toHaveCount(0);
      return;
    }
    await expect(address).toBeVisible();
    await expect(phonePanel.getByRole("button", { name: "Copy" })).toBeVisible();
    const qr = phonePanel.getByRole("img", { name: /^QR code for / });
    await expect(qr).toBeVisible();
    await expect.poll(() => qr.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  });

  test("narrow widths show the overview and access pages without horizontal scroll", async () => {
    test.skip(test.info().project.name !== "iphone", "only the phone viewport is narrow");
    await page.goto("/");
    await expect(page.getByText(ACCOUNT.displayName, { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.goto("/settings/access");
    await expect(page.getByRole("heading", { name: "Open on your phone" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("logging out returns to the login page", async () => {
    await logOut(page);
  });

  test("logging in with a trusted device sets an http-only session that survives a reload", async () => {
    const response = await submitLogin(page, ACCOUNT.password, true);
    expect(response.status()).toBe(200);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(ACCOUNT.displayName, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.cookie)).toBe("");
    await page.reload();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(ACCOUNT.displayName, { exact: true })).toBeVisible();
  });

  test("logging out again returns to the login page", async () => {
    await logOut(page);
  });

  test("five wrong passwords lock the account and the right password stays locked out", async () => {
    for (let attempt = 1; attempt <= FAILURES_BEFORE_LOCK; attempt += 1) {
      const response = await submitLogin(page, WRONG_PASSWORD, false);
      expect(response.status(), `attempt ${attempt}`).toBe(401);
      await expect(loginAlert(page)).toHaveText(WRONG_PASSWORD_MESSAGE);
    }
    const locked = await submitLogin(page, WRONG_PASSWORD, false);
    expect(locked.status()).toBe(423);
    await expect(loginAlert(page)).toHaveText(LOCKED_MESSAGE);
    const stillLocked = await submitLogin(page, ACCOUNT.password, false);
    expect(stillLocked.status()).toBe(423);
    await expect(loginAlert(page)).toHaveText(LOCKED_MESSAGE);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("every request stayed on the local origin", () => {
    expect(requestedUrls.length).toBeGreaterThan(0);
    expect(offOriginUrls(requestedUrls), `requests left the origin: ${offOriginUrls(requestedUrls).join(", ")}`).toEqual([]);
  });
});
