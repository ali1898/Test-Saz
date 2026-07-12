# Design Spec: Prompt Engineering + Harness Engineering + Agentic Engineering

> **Date**: 2026-07-12
> **Status**: Draft
> **Scope**: Three-layer enhancement to QA Test Generator

---

## [S1] Problem

The QA Test Generator has solid foundations but lacks:
1. **Prompt Engineering**: Duplicated system prompts, no reasoning instructions, no self-validation
2. **Harness Engineering**: No network stubbing, visual regression, accessibility, or test isolation
3. **Agentic Engineering**: No self-healing, autonomous generation, multi-agent pipeline, or feedback loops

---

## [S2] Architecture Overview

Three layers, each building on the previous:

```
┌─────────────────────────────────────────────┐
│           Agentic Engineering               │
│  (Self-Healing, Autonomous, Multi-Agent,    │
│   Feedback Loop)                            │
├─────────────────────────────────────────────┤
│           Harness Engineering               │
│  (Network Stubbing, Visual Regression,      │
│   Accessibility, Test Isolation)            │
├─────────────────────────────────────────────┤
│           Prompt Engineering                │
│  (Shared Prompt, Chain-of-Thought,          │
│   Self-Critique, Edge Cases)                │
└─────────────────────────────────────────────┘
```

---

## [S3] Prompt Engineering

### [S3.1] Shared System Prompt

**Problem**: `QA_SYSTEM_PROMPT` is duplicated in `generate.ts:8-32` and `page-analyzer.ts:11-35`.

**Solution**:
- Extract to `packages/core/src/generator/prompts.ts`
- Single source of truth for all LLM prompts
- Add prompt templates for each artifact type (locators, page, test, helper, bdd, command)

**Files to modify**:
- `packages/core/src/generator/prompts.ts` (NEW)
- `packages/core/src/generator/generate.ts`
- `packages/core/src/generator/page-analyzer.ts`

### [S3.2] Chain-of-Thought

**Problem**: LLM generates code without reasoning first.

**Solution**: Add `## Reasoning` section to prompts that instructs LLM to:
1. Analyze the scenario/goal
2. Identify required elements
3. Plan the structure
4. Then generate code

**Example prompt addition**:
```
Before generating code, think step by step:
1. What elements does this scenario need?
2. What locators are appropriate for each element?
3. What methods should the page object expose?
4. What assertions are needed?

Then generate the code following these steps.
```

**Files to modify**:
- `packages/core/src/generator/prompts.ts`

### [S3.3] Self-Critique

**Problem**: No validation of LLM output.

**Solution**: Add a post-generation validation prompt:
```
Review the generated code against these checks:
1. Does it follow the structure guide conventions?
2. Are all imports correct and paths valid?
3. Does the page object use proper Cypress patterns?
4. Are locators using the preferred selector strategy?
5. Is the test following the POM pattern (no direct cy.get)?

List any issues found. If no issues, respond with "VALID".
```

**Implementation**: After each `askLlm()` call in `generateAll()`, run a validation prompt. If issues found, retry with feedback.

**Files to modify**:
- `packages/core/src/generator/generate.ts`
- `packages/core/src/generator/prompts.ts`

### [S3.4] Edge Case Testing

**Problem**: Generated tests only cover happy path.

**Solution**: Add edge case generation prompt:
```
Generate additional test cases for edge cases:
- Empty required fields
- Special characters in inputs
- Very long text inputs
- Invalid email formats
- Password too short/long
- SQL injection attempts
- XSS attempts
- Network timeout scenarios
```

**Files to modify**:
- `packages/core/src/generator/prompts.ts`
- `packages/core/src/generator/generate.ts`

---

## [S4] Harness Engineering

### [S4.1] Network Stubbing

**Problem**: API calls hit real servers during tests.

**Solution**: Generate `cy.intercept()` fixtures with test data.

**New template function**: `networkStubTemplate()` in `templates.ts`
```typescript
// cypress/fixtures/api-stubs/login.json
{
  "POST /api/auth/login": {
    "success": { "status": 200, "body": { "token": "test-token", "user": { "id": 1 } } },
    "failure": { "status": 401, "body": { "error": "Invalid credentials" } },
    "error": { "status": 500, "body": { "error": "Server error" } }
  }
}
```

**New custom command**: `cy.stubApi(fixtureName, route)` in `commands.ts`

**Files to modify**:
- `packages/core/src/generator/templates.ts`
- `packages/core/src/generator/scaffold.ts`

### [S4.2] Visual Regression

**Problem**: No visual comparison between test runs.

**Solution**: Integrate `cypress-image-snapshot`.

**New template**: `visualRegressionConfig()` in `templates.ts`
```typescript
// cypress/support/visual-regression.ts
import { matchImageSnapshot } from 'cypress-image-snapshot';
Cypress.Commands.add('matchScreenshot', (name, options = {}) => {
  cy.matchImageSnapshot({ ...options, capture: 'viewport' });
});
```

**New npm dependency**: `cypress-image-snapshot`

**Files to modify**:
- `packages/core/src/generator/templates.ts`
- `packages/core/src/generator/scaffold.ts`

### [S4.3] Accessibility Testing

**Problem**: No ARIA/semantic testing.

**Solution**: Integrate `cypress-axe`.

**New template**: `a11yCommands()` in `templates.ts`
```typescript
// cypress/support/a11y.ts
import 'cypress-axe';
Cypress.Commands.add('checkA11y', (context, options) => {
  cy.injectAxe();
  cy.checkA11y(context, options);
});
```

**New npm dependency**: `cypress-axe`, `axe-core`

**Files to modify**:
- `packages/core/src/generator/templates.ts`
- `packages/core/src/generator/scaffold.ts`

### [S4.4] Test Isolation

**Problem**: Tests share state.

**Solution**: Add isolation mechanisms.

**New template**: `testIsolationCommands()` in `templates.ts`
```typescript
// cypress/support/commands.ts
Cypress.Commands.add('resetDatabase', () => {
  cy.request('POST', '/api/test/reset');
});
Cypress.Commands.add('seedDatabase', (fixture) => {
  cy.fixture(fixture).then(data => {
    cy.request('POST', '/api/test/seed', data);
  });
});
```

**Files to modify**:
- `packages/core/src/generator/templates.ts`
- `packages/core/src/generator/scaffold.ts`

---

## [S5] Agentic Engineering

### [S5.1] Self-Healing Tests

**Problem**: Tests break when selectors change.

**Solution**: Fallback selector chain.

**New custom command**: `cy.getHealed(selector, fallbacks)` in `commands.ts`
```typescript
Cypress.Commands.add('getHealed', (primarySelector, fallbacks = []) => {
  const selectors = [primarySelector, ...fallbacks];
  cy.get('body').then(($body) => {
    for (const sel of selectors) {
      if ($body.find(sel).length > 0) {
        return cy.get(sel);
      }
    }
    throw new Error(`No element found for selectors: ${selectors.join(', ')}`);
  });
});
```

**Enhancement**: After test failure, analyze DOM and suggest new selectors.

**Files to modify**:
- `packages/core/src/generator/templates.ts`
- `packages/core/src/commands/healing.ts` (NEW)

### [S5.2] Autonomous Generation

**Problem**: User must provide URL and goal.

**Solution**: Agent crawls site and generates tests autonomously.

**New command**: `qa autonomous` or `qa aa`
```
qa autonomous --base-url "http://localhost:3000" --depth 2
```

**Flow**:
1. Crawl all links up to depth
2. Analyze each page
3. Generate scenarios for each page
4. Generate locators + page objects + tests
5. Report generated artifacts

**Files to create**:
- `packages/cli/src/commands/autonomous.ts`
- `packages/core/src/generator/crawler.ts`

### [S5.3] Multi-Agent Pipeline

**Problem**: Sequential generation is slow.

**Solution**: Parallel agents for independent tasks.

**New architecture**:
```
Orchestrator Agent
├── Agent 1: Locators (independent)
├── Agent 2: Page Object (depends on locators)
├── Agent 3: Test Spec (depends on page object)
└── Validator: Reviews all outputs
```

**Implementation**: Use `Promise.all()` for independent agents, sequential for dependent ones.

**Files to modify**:
- `packages/core/src/generator/generate.ts`
- `packages/core/src/generator/pipeline.ts` (NEW)

### [S5.4] Feedback Loop

**Problem**: Failed tests require manual analysis.

**Solution**: Agent analyzes failures and suggests fixes.

**New command**: `qa fix` or `qa feedback`
```
qa fix --test "cypress/e2e/test/smoke/login.cy.ts" --report allure-report/
```

**Flow**:
1. Parse test failure report
2. Analyze error message and stack trace
3. Read the test file
4. Suggest fix (selector update, timing fix, assertion change)
5. Apply fix if `--yes` flag provided

**Files to create**:
- `packages/cli/src/commands/fix.ts`
- `packages/core/src/generator/fixer.ts`

---

## [S6] Implementation Order

### Phase 1: Prompt Engineering (Foundation)
1. Extract shared system prompt to `prompts.ts`
2. Add chain-of-thought instructions
3. Add self-critique validation
4. Add edge case testing prompts

### Phase 2: Harness Engineering (Infrastructure)
1. Add network stubbing templates
2. Add visual regression support
3. Add accessibility testing
4. Add test isolation commands

### Phase 3: Agentic Engineering (Automation)
1. Add self-healing selectors
2. Add autonomous generation
3. Add multi-agent pipeline
4. Add feedback loop

---

## [S7] Verification

### Prompt Engineering
- Build project: `npm run build`
- Generate a test: `qa generate all -g "login" -u "http://localhost:3000/login"`
- Verify LLM reasoning appears in output
- Verify self-critique catches errors

### Harness Engineering
- Scaffold a project: `qa new --yes`
- Verify network stubs work: `cy.intercept()` with fixture data
- Verify visual regression: `cy.matchScreenshot('login')`
- Verify accessibility: `cy.checkA11y()`

### Agentic Engineering
- Test self-healing: Change a selector, run test, verify fallback works
- Test autonomous: `qa autonomous --base-url "http://localhost:3000" --depth 1`
- Test feedback loop: `qa fix --test "cypress/e2e/test/smoke/login.cy.ts"`

---

## [S8] Dependencies

| Package | Purpose | New/Existing |
|---------|---------|--------------|
| `cypress-image-snapshot` | Visual regression | New |
| `cypress-axe` | Accessibility | New |
| `axe-core` | A11y engine | New |

All other enhancements are code-only (no new dependencies).
