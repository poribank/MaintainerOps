import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkItem } from "@maintainerops/core";
import { loadConfig, type AppConfig } from "../src/config.js";
import {
  createMaintainerAiAssistant,
  DisabledMaintainerAiAssistant,
  OpenAiMaintainerAssistant
} from "../src/services/ai-assistant.js";

describe("Maintainer AI assistant", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns rule-based fallback details when AI is disabled", async () => {
    const assistant = new DisabledMaintainerAiAssistant(config({ provider: "disabled" }));

    const result = await assistant.assist(workItem(), {
      kind: "issue_triage",
      includeRawContent: true,
      rawContent: "token = should-not-matter"
    });

    expect(result).toMatchObject({
      enabled: false,
      provider: "disabled",
      usedRawContent: false,
      redacted: false
    });
    expect(result.summary).toContain("Issue triage assistance");
    expect(result.suggestedActions).toEqual(["Add bug label"]);
    expect(result.safetyNotes).toContain("No raw repository content was sent externally.");
  });

  it("uses the OpenAI adapter only when provider and API key are configured", () => {
    expect(createMaintainerAiAssistant(config({ provider: "openai" }))).toBeInstanceOf(
      DisabledMaintainerAiAssistant
    );
    expect(createMaintainerAiAssistant(config({ provider: "openai", apiKey: "test-key" }))).toBeInstanceOf(
      OpenAiMaintainerAssistant
    );
  });

  it("omits raw repository content when the request does not opt in", async () => {
    const fetchMock = stubOpenAi(outputTextResponse());
    const assistant = new OpenAiMaintainerAssistant(config({ provider: "openai", apiKey: "test-key" }));

    const result = await assistant.assist(workItem(), {
      kind: "pr_review",
      includeRawContent: false,
      rawContent: "token = abcdefghijklmnopqrstuvwxyz123456"
    });

    const { request, input } = sentOpenAiRequest(fetchMock);
    expect(request.model).toBe("test-model");
    expect(request.text.format).toMatchObject({
      type: "json_schema",
      name: "maintainer_assistance",
      strict: true
    });
    expect(input.rawContent).toBeUndefined();
    expect(input.safetyPolicy).toMatchObject({
      noAutomerge: true,
      noAutoApproval: true,
      approvalRequiredForWrites: true,
      rawContentWasRedacted: false
    });
    expect(result).toMatchObject({
      enabled: true,
      provider: "openai",
      model: "test-model",
      usedRawContent: false,
      redacted: false
    });
  });

  it("redacts and truncates raw repository content before sending it to OpenAI", async () => {
    const fetchMock = stubOpenAi(outputTextResponse());
    const assistant = new OpenAiMaintainerAssistant(
      config({ provider: "openai", apiKey: "test-key", maxInputChars: 32 })
    );

    const result = await assistant.assist(workItem(), {
      kind: "security_review",
      includeRawContent: true,
      rawContent: `token = abcdefghijklmnopqrstuvwxyz123456\n${"diff ".repeat(20)}`
    });

    const { input } = sentOpenAiRequest(fetchMock);
    expect(input.rawContent).toContain("[REDACTED]");
    expect(input.rawContent).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(input.rawContent).toHaveLength(32);
    expect(input.safetyPolicy.rawContentWasRedacted).toBe(true);
    expect(result).toMatchObject({
      usedRawContent: true,
      redacted: true
    });
  });

  it("parses nested Responses API text content", async () => {
    stubOpenAi(
      new Response(
        JSON.stringify({
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    summary: "Nested response summary.",
                    rationale: ["Nested content was parsed."],
                    suggestedActions: ["Review the policy finding."],
                    safetyNotes: ["Do not auto-merge."]
                  })
                }
              ]
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const assistant = new OpenAiMaintainerAssistant(config({ provider: "openai", apiKey: "test-key" }));

    await expect(
      assistant.assist(workItem(), {
        kind: "release_readiness",
        includeRawContent: false
      })
    ).resolves.toMatchObject({
      summary: "Nested response summary.",
      rationale: ["Nested content was parsed."]
    });
  });

  it("normalizes blank and mixed-type OpenAI response fields", async () => {
    stubOpenAi(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            summary: "   ",
            rationale: ["  Evidence from policy.  ", "", 42],
            suggestedActions: [null, "   "],
            safetyNotes: "Keep a maintainer in the loop."
          })
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const assistant = new OpenAiMaintainerAssistant(config({ provider: "openai", apiKey: "test-key" }));

    await expect(
      assistant.assist(workItem(), {
        kind: "release_readiness",
        includeRawContent: false
      })
    ).resolves.toMatchObject({
      summary: "No summary returned.",
      rationale: ["Evidence from policy."],
      suggestedActions: ["Review the work item manually."],
      safetyNotes: ["Maintainer approval remains required."]
    });
  });

  it("surfaces provider failures without parsing a success body", async () => {
    stubOpenAi(new Response("rate limited", { status: 429 }));
    const assistant = new OpenAiMaintainerAssistant(config({ provider: "openai", apiKey: "test-key" }));

    await expect(
      assistant.assist(workItem(), {
        kind: "pr_review",
        includeRawContent: false
      })
    ).rejects.toThrow("OpenAI assistance request failed: 429 rate limited");
  });
});

function config(ai: Partial<AppConfig["ai"]> = {}): AppConfig {
  const base = loadConfig({
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    PORT: "0",
    WEB_ORIGIN: "http://localhost:5173",
    GITHUB_WEBHOOK_SECRET: "test-secret",
    AI_PROVIDER: ai.provider,
    OPENAI_API_KEY: ai.apiKey,
    OPENAI_MODEL: "test-model",
    SEED_DEMO_DATA: "false"
  });

  return {
    ...base,
    ai: {
      ...base.ai,
      ...ai
    }
  };
}

function stubOpenAi(response: Response) {
  const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function outputTextResponse() {
  return new Response(
    JSON.stringify({
      output_text: JSON.stringify({
        summary: "Review the work item.",
        rationale: ["Rule-based findings were used."],
        suggestedActions: ["Ask for maintainer review."],
        safetyNotes: ["Maintainer approval remains required."]
      })
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

function sentOpenAiRequest(fetchMock: ReturnType<typeof stubOpenAi>) {
  const call = fetchMock.mock.calls[0];
  expect(call).toBeDefined();
  const [url, init] = call!;
  expect(url).toBe("https://api.openai.com/v1/responses");
  expect(init).toBeDefined();
  const request = JSON.parse(String(init!.body)) as OpenAiRequestBody;
  return {
    request,
    input: JSON.parse(request.input) as AssistantInput
  };
}

interface OpenAiRequestBody {
  model: string;
  input: string;
  text: {
    format: {
      type: string;
      name: string;
      strict: boolean;
    };
  };
}

interface AssistantInput {
  rawContent?: string;
  safetyPolicy: {
    noAutomerge: boolean;
    noAutoApproval: boolean;
    approvalRequiredForWrites: boolean;
    rawContentWasRedacted: boolean;
  };
}

function workItem(): WorkItem {
  return {
    id: "pull_request:org/repo:42",
    kind: "pull_request",
    status: "open",
    repository: {
      owner: "org",
      name: "repo",
      fullName: "org/repo",
      private: false,
      installationId: 123
    },
    title: "Improve release workflow",
    number: 42,
    externalId: "pull_request:org/repo:42",
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:01.000Z",
    labels: ["bug"],
    sourceDeliveryIds: ["delivery-1"],
    analysis: {
      summary: "Pull request needs review.",
      risk: {
        value: 4,
        priority: "normal",
        factors: []
      },
      findings: [
        {
          id: "finding-1",
          title: "Release workflow changed",
          severity: "medium",
          source: "policy",
          description: "The workflow touches release automation."
        }
      ],
      recommendations: [
        {
          id: "recommendation-1",
          action: "add_label",
          title: "Add bug label",
          description: "Keep the work item discoverable.",
          confidence: 0.8,
          labels: ["bug"],
          requiresApproval: true
        }
      ]
    }
  };
}
