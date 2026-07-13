import { describe, it, expect, vi } from "vitest";
import { executeSteps } from "./steps-executor";
import type { Page } from "playwright";

function mockPage(): Page {
  const page = {
    click: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    check: vi.fn().mockResolvedValue(undefined),
    uncheck: vi.fn().mockResolvedValue(undefined),
    hover: vi.fn().mockResolvedValue(undefined),
    keyboard: { press: vi.fn().mockResolvedValue(undefined) },
    locator: () => ({ scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined) }),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
  return page;
}

describe("executeSteps", () => {
  it("executes click action", async () => {
    const page = mockPage();
    await executeSteps(page, { steps: [{ action: "click", selector: "#btn" }] });
    expect(page.click).toHaveBeenCalledWith("#btn", { timeout: 5000 });
  });

  it("executes select action with value", async () => {
    const page = mockPage();
    await executeSteps(page, { steps: [{ action: "select", selector: "#sel", value: "opt1" }] });
    expect(page.selectOption).toHaveBeenCalledWith("#sel", "opt1", { timeout: 5000 });
  });

  it("executes type action with value", async () => {
    const page = mockPage();
    await executeSteps(page, { steps: [{ action: "type", selector: "#input", value: "hello" }] });
    expect(page.fill).toHaveBeenCalledWith("#input", "hello", { timeout: 5000 });
  });

  it("executes wait action", async () => {
    const page = mockPage();
    await executeSteps(page, { steps: [{ action: "wait", selector: ".loaded" }] });
    expect(page.waitForSelector).toHaveBeenCalledWith(".loaded", { timeout: 5000 });
  });

  it("executes check action", async () => {
    const page = mockPage();
    await executeSteps(page, { steps: [{ action: "check", selector: "#agree" }] });
    expect(page.check).toHaveBeenCalledWith("#agree", { timeout: 5000 });
  });

  it("executes uncheck action", async () => {
    const page = mockPage();
    await executeSteps(page, { steps: [{ action: "uncheck", selector: "#agree" }] });
    expect(page.uncheck).toHaveBeenCalledWith("#agree", { timeout: 5000 });
  });

  it("executes hover action", async () => {
    const page = mockPage();
    await executeSteps(page, { steps: [{ action: "hover", selector: ".menu" }] });
    expect(page.hover).toHaveBeenCalledWith(".menu", { timeout: 5000 });
  });

  it("executes press action with default Enter", async () => {
    const page = mockPage();
    await executeSteps(page, { steps: [{ action: "press", selector: "" }] });
    expect(page.keyboard.press).toHaveBeenCalledWith("Enter");
  });

  it("executes press action with custom key", async () => {
    const page = mockPage();
    await executeSteps(page, { steps: [{ action: "press", selector: "", value: "Tab" }] });
    expect(page.keyboard.press).toHaveBeenCalledWith("Tab");
  });

  it("throws on select without value", async () => {
    const page = mockPage();
    await expect(
      executeSteps(page, { steps: [{ action: "select", selector: "#sel" }] })
    ).rejects.toThrow("requires a value");
  });

  it("throws on type without value", async () => {
    const page = mockPage();
    await expect(
      executeSteps(page, { steps: [{ action: "type", selector: "#input" }] })
    ).rejects.toThrow("requires a value");
  });

  it("calls waitForTimeout after all steps", async () => {
    const page = mockPage();
    await executeSteps(page, { steps: [{ action: "click", selector: "#a" }], waitAfterMs: 3000 });
    expect(page.waitForTimeout).toHaveBeenCalledWith(3000);
  });

  it("uses custom timeout from step", async () => {
    const page = mockPage();
    await executeSteps(page, { steps: [{ action: "click", selector: "#btn", timeout: 10000 }] });
    expect(page.click).toHaveBeenCalledWith("#btn", { timeout: 10000 });
  });

  it("executes multiple steps in order", async () => {
    const page = mockPage();
    const calls: string[] = [];
    (page.click as ReturnType<typeof vi.fn>).mockImplementation(async () => { calls.push("click"); });
    (page.fill as ReturnType<typeof vi.fn>).mockImplementation(async () => { calls.push("fill"); });

    await executeSteps(page, {
      steps: [
        { action: "click", selector: "#btn" },
        { action: "type", selector: "#input", value: "text" },
      ],
    });

    expect(calls).toEqual(["click", "fill"]);
  });
});
