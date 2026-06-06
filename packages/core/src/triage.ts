import type { MaintainerOpsPolicy, Recommendation } from "./types.js";
import { DEFAULT_POLICY } from "./policy.js";

export interface IssueTriageInput {
  title: string;
  body?: string | undefined;
  labels?: string[] | undefined;
  authorAssociation?: string | undefined;
}

const LABEL_RULES: Array<{
  label: string;
  confidence: number;
  pattern: RegExp;
  description: string;
}> = [
  {
    label: "security",
    confidence: 0.9,
    pattern:
      /\b(cve|vulnerability|exploit|secret|credential|access token|private key|token leak|xss|rce|sql injection)\b/i,
    description: "The issue appears to describe a security-sensitive problem."
  },
  {
    label: "bug",
    confidence: 0.78,
    pattern: /\b(error|crash|bug|regression|broken|fails?|exception|stack trace)\b/i,
    description: "The report describes a failure or regression."
  },
  {
    label: "documentation",
    confidence: 0.76,
    pattern: /\b(docs?|readme|documentation|typo|example|guide)\b/i,
    description: "The report is primarily about documentation."
  },
  {
    label: "enhancement",
    confidence: 0.7,
    pattern: /\b(feature|enhancement|request|support|proposal|improve)\b/i,
    description: "The report asks for a new or improved capability."
  }
];

export function recommendIssueLabels(
  input: IssueTriageInput,
  policy: MaintainerOpsPolicy = DEFAULT_POLICY
): Recommendation[] {
  const text = `${input.title}\n${input.body ?? ""}`;
  const existing = new Set(input.labels ?? []);
  const allowed = new Set(policy.labels.allowed);
  const recommendations: Recommendation[] = [];

  for (const rule of LABEL_RULES) {
    if (!allowed.has(rule.label) || existing.has(rule.label) || !rule.pattern.test(text)) {
      continue;
    }

    recommendations.push({
      id: `label:${rule.label}`,
      action: "add_label",
      title: `Add ${rule.label} label`,
      description: rule.description,
      confidence: rule.confidence,
      labels: [rule.label],
      requiresApproval: !policy.automation.applyLabels
    });
  }

  if (needsReproduction(text, existing, allowed)) {
    recommendations.push({
      id: "label:needs-reproduction",
      action: "add_label",
      title: "Ask for reproduction details",
      description: "The report looks like a bug but does not include enough reproduction detail.",
      confidence: 0.72,
      labels: ["needs-reproduction"],
      requiresApproval: !policy.automation.applyLabels
    });
  }

  if (needsDuplicateReview(text)) {
    recommendations.push({
      id: "triage:duplicate-review",
      action: "review_required",
      title: "Review possible duplicate",
      description: "The report references duplicate or already-reported behavior and needs maintainer confirmation.",
      confidence: 0.68,
      requiresApproval: false
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "triage:no-action",
      action: "no_action",
      title: "No label recommendation",
      description: "No configured label rules matched this issue.",
      confidence: 0.5,
      requiresApproval: false
    });
  }

  return recommendations;
}

function needsReproduction(text: string, existing: Set<string>, allowed: Set<string>): boolean {
  const looksLikeBug = /\b(error|crash|bug|regression|broken|fails?|exception)\b/i.test(text);
  const hasSteps = /\b(steps to reproduce|reproduction|minimal repro|expected|actual)\b/i.test(text);
  return looksLikeBug && !hasSteps && allowed.has("needs-reproduction") && !existing.has("needs-reproduction");
}

function needsDuplicateReview(text: string): boolean {
  return /\b(duplicate|dupe|already reported|same as|related to #\d+|duplicates #\d+)\b/i.test(text);
}
