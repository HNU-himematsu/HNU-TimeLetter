import { expect, test } from "@playwright/test";

test("首页可以成功打开", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });

  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("body")).toBeVisible();
});
