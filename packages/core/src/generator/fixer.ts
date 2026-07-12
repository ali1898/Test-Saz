import type { LLMProvider } from "../llm/types";

export interface FailureAnalysis {
  testFile: string;
  error: string;
  stackTrace: string;
  suggestedFix: string;
}

export function parseFailureReport(reportPath: string): FailureAnalysis[] {
  // Simplified - real implementation would parse JSON/HTML reports
  return [];
}

export async function suggestFix(
  provider: LLMProvider,
  testFile: string,
  error: string,
  stackTrace: string,
): Promise<string> {
  const prompt = `You are debugging a failing Cypress test.

Test file: ${testFile}
Error: ${error}
Stack trace:
${stackTrace}

Analyze the error and suggest a fix. Return ONLY the corrected test code.`;

  const messages = [{ role: "user" as const, content: prompt }];
  const response = await provider.chat(messages, { temperature: 0.2, maxTokens: 4096 });
  return response.content;
}
