import type { Finding, Recommendation, WorkItem } from "@maintainerops/core";
import { redactSensitiveText } from "@maintainerops/core";
import type { AppConfig } from "../config.js";

export type AiAssistanceKind = "pr_review" | "issue_triage" | "release_readiness" | "security_review";

export interface AiAssistanceRequest {
  kind: AiAssistanceKind;
  includeRawContent: boolean;
  rawContent?: string | undefined;
}

export interface AiAssistanceResult {
  enabled: boolean;
  provider: "disabled" | "openai" | "anthropic" | "local";
  model?: string;
  summary: string;
  rationale: string[];
  suggestedActions: string[];
  safetyNotes: string[];
  usedRawContent: boolean;
  redacted: boolean;
}

export interface MaintainerAiAssistant {
  assist(workItem: WorkItem, request: AiAssistanceRequest): Promise<AiAssistanceResult>;
}

export function createMaintainerAiAssistant(config: AppConfig): MaintainerAiAssistant {
  if (config.ai.provider === "openai" && config.ai.apiKey) {
    return new OpenAiMaintainerAssistant(config);
  }

  return new DisabledMaintainerAiAssistant(config);
}

export class DisabledMaintainerAiAssistant implements MaintainerAiAssistant {
  constructor(private readonly config: AppConfig) {}

  async assist(workItem: WorkItem, request: AiAssistanceRequest): Promise<AiAssistanceResult> {
    return {
      enabled: false,
      provider: this.config.ai.provider,
      model: this.config.ai.model,
      summary: `${labelForKind(request.kind)} is available after AI is explicitly configured.`,
      rationale: [
        `Work item ${workItem.id} is still fully handled by rule-based findings and recommendations.`,
        "Set AI_PROVIDER=openai and OPENAI_API_KEY to enable optional AI assistance."
      ],
      suggestedActions: workItem.analysis.recommendations.map((recommendation) => recommendation.title),
      safetyNotes: [
        "AI is disabled by default.",
        "No raw repository content was sent externally.",
        "Maintainer approval remains required for write actions."
      ],
      usedRawContent: false,
      redacted: false
    };
  }
}

export class OpenAiMaintainerAssistant implements MaintainerAiAssistant {
  constructor(private readonly config: AppConfig) {}

  async assist(workItem: WorkItem, request: AiAssistanceRequest): Promise<AiAssistanceResult> {
    const rawContent = request.includeRawContent ? request.rawContent ?? "" : "";
    const redactedRawContent = rawContent ? redactSensitiveText(rawContent).slice(0, this.config.ai.maxInputChars) : "";
    const input = buildAssistantInput(workItem, request.kind, redactedRawContent);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.ai.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: this.config.ai.model,
        input,
        text: {
          format: {
            type: "json_schema",
            name: "maintainer_assistance",
            strict: true,
            schema: assistanceJsonSchema
          }
        }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI assistance request failed: ${response.status} ${body.slice(0, 500)}`);
    }

    const body = (await response.json()) as OpenAiResponsesBody;
    const text = extractResponseText(body);
    const parsed = parseAssistanceJson(text);

    return {
      enabled: true,
      provider: "openai",
      model: this.config.ai.model,
      ...parsed,
      usedRawContent: redactedRawContent.length > 0,
      redacted: redactedRawContent !== rawContent
    };
  }
}

const assistanceJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "rationale", "suggestedActions", "safetyNotes"],
  properties: {
    summary: { type: "string" },
    rationale: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5
    },
    suggestedActions: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5
    },
    safetyNotes: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5
    }
  }
};

interface OpenAiResponsesBody {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  output_text?: string;
}

function buildAssistantInput(workItem: WorkItem, kind: AiAssistanceKind, redactedRawContent: string): string {
  const payload = {
    task: kind,
    instruction:
      "Help an open-source maintainer review this work item. Be concise, evidence-based, and conservative. Do not recommend auto-merge or auto-approval.",
    workItem: {
      id: workItem.id,
      kind: workItem.kind,
      repository: workItem.repository.fullName,
      title: workItem.title,
      number: workItem.number,
      labels: workItem.labels,
      risk: workItem.analysis.risk,
      findings: workItem.analysis.findings.map(summarizeFinding),
      recommendations: workItem.analysis.recommendations.map(summarizeRecommendation)
    },
    rawContent: redactedRawContent || undefined,
    safetyPolicy: {
      noAutomerge: true,
      noAutoApproval: true,
      approvalRequiredForWrites: true,
      rawContentWasRedacted: Boolean(redactedRawContent)
    }
  };

  return JSON.stringify(payload);
}

function summarizeFinding(finding: Finding) {
  return {
    id: finding.id,
    title: finding.title,
    severity: finding.severity,
    source: finding.source,
    description: finding.description
  };
}

function summarizeRecommendation(recommendation: Recommendation) {
  return {
    id: recommendation.id,
    action: recommendation.action,
    title: recommendation.title,
    description: recommendation.description,
    confidence: recommendation.confidence,
    requiresApproval: recommendation.requiresApproval
  };
}

function extractResponseText(body: OpenAiResponsesBody): string {
  if (body.output_text) return body.output_text;

  for (const item of body.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") {
        return content.text;
      }
    }
  }

  throw new Error("OpenAI response did not include text output.");
}

function parseAssistanceJson(text: string): Pick<
  AiAssistanceResult,
  "summary" | "rationale" | "suggestedActions" | "safetyNotes"
> {
  const parsed = JSON.parse(text) as Partial<AiAssistanceResult>;
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "No summary returned.",
    rationale: stringArray(parsed.rationale),
    suggestedActions: stringArray(parsed.suggestedActions),
    safetyNotes: stringArray(parsed.safetyNotes)
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function labelForKind(kind: AiAssistanceKind): string {
  switch (kind) {
    case "pr_review":
      return "PR review assistance";
    case "issue_triage":
      return "Issue triage assistance";
    case "release_readiness":
      return "Release readiness assistance";
    case "security_review":
      return "Security review assistance";
  }
}
