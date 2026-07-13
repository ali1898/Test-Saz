import { describe, it, expect } from "vitest";
import type { Step, StepsConfig } from "../types";

describe("Step types", () => {
  it("Step has required fields", () => {
    const step: Step = { action: "click", selector: "#btn" };
    expect(step.action).toBe("click");
    expect(step.selector).toBe("#btn");
  });

  it("Step allows optional value", () => {
    const step: Step = { action: "type", selector: "#input", value: "hello" };
    expect(step.value).toBe("hello");
  });

  it("StepsConfig wraps steps array", () => {
    const config: StepsConfig = {
      steps: [{ action: "click", selector: "#a" }],
      waitAfterMs: 2000,
    };
    expect(config.steps).toHaveLength(1);
    expect(config.waitAfterMs).toBe(2000);
  });
});
