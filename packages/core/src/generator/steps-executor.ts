import type { Page } from "playwright";
import type { Step, StepsConfig } from "./types";

export async function executeSteps(page: Page, config: StepsConfig): Promise<void> {
  for (const step of config.steps) {
    await executeStep(page, step);
  }
  if (config.waitAfterMs && config.waitAfterMs > 0) {
    await page.waitForTimeout(config.waitAfterMs);
  }
}

async function executeStep(page: Page, step: Step): Promise<void> {
  const timeout = step.timeout ?? 5000;

  switch (step.action) {
    case "click":
      await page.click(step.selector, { timeout });
      break;

    case "select":
      if (!step.value) throw new Error(`Step "select" requires a value: ${step.selector}`);
      await page.selectOption(step.selector, step.value, { timeout });
      break;

    case "type":
      if (!step.value) throw new Error(`Step "type" requires a value: ${step.selector}`);
      await page.fill(step.selector, step.value, { timeout });
      break;

    case "wait":
      await page.waitForSelector(step.selector, { timeout });
      break;

    case "check":
      await page.check(step.selector, { timeout });
      break;

    case "uncheck":
      await page.uncheck(step.selector, { timeout });
      break;

    case "hover":
      await page.hover(step.selector, { timeout });
      break;

    case "scroll":
      await page.locator(step.selector).scrollIntoViewIfNeeded();
      break;

    case "press":
      await page.keyboard.press(step.value ?? "Enter");
      break;
  }
}
