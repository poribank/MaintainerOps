import yaml from "js-yaml";
import { z } from "zod";
import type { MaintainerOpsPolicy, PolicyValidationResult } from "./types.js";

export const DEFAULT_POLICY: MaintainerOpsPolicy = {
  version: 1,
  automation: {
    applyLabels: false,
    writePrComments: false,
    createReleaseDrafts: false
  },
  ai: {
    enabled: false,
    provider: "disabled"
  },
  dataRetention: {
    rawContent: false,
    rawContentDays: 0,
    analysisDays: 180,
    auditLogDays: 365
  },
  labels: {
    allowed: ["bug", "enhancement", "documentation", "needs-reproduction", "security"]
  },
  policy: {
    requireSecurityMd: true,
    requireCodeowners: true,
    requireScorecard: true,
    minimumScorecardScore: 7
  },
  release: {
    requireProvenance: true,
    blockOnUnresolvedAdvisory: true
  }
};

const rawPolicySchema = z
  .object({
    version: z.literal(1).optional(),
    automation: z
      .object({
        applyLabels: z.boolean().optional(),
        writePrComments: z.boolean().optional(),
        createReleaseDrafts: z.boolean().optional()
      })
      .strict()
      .optional(),
    ai: z
      .object({
        enabled: z.boolean().optional(),
        provider: z.enum(["disabled", "openai", "anthropic", "local"]).optional()
      })
      .strict()
      .optional(),
    dataRetention: z
      .object({
        rawContent: z.boolean().optional(),
        rawContentDays: z.number().int().min(0).max(365).optional(),
        analysisDays: z.number().int().min(1).max(3650).optional(),
        auditLogDays: z.number().int().min(30).max(3650).optional()
      })
      .strict()
      .optional(),
    labels: z
      .object({
        allowed: z.array(z.string().min(1)).optional()
      })
      .strict()
      .optional(),
    policy: z
      .object({
        requireSecurityMd: z.boolean().optional(),
        requireCodeowners: z.boolean().optional(),
        requireScorecard: z.boolean().optional(),
        minimumScorecardScore: z.number().min(0).max(10).optional()
      })
      .strict()
      .optional(),
    release: z
      .object({
        requireProvenance: z.boolean().optional(),
        blockOnUnresolvedAdvisory: z.boolean().optional()
      })
      .strict()
      .optional()
  })
  .strict();

type RawPolicy = z.infer<typeof rawPolicySchema>;

export function mergePolicy(raw: RawPolicy): MaintainerOpsPolicy {
  const aiProvider = raw.ai?.provider ?? DEFAULT_POLICY.ai.provider;
  const aiEnabled = raw.ai?.enabled ?? DEFAULT_POLICY.ai.enabled;

  return {
    version: 1,
    automation: {
      applyLabels: raw.automation?.applyLabels ?? DEFAULT_POLICY.automation.applyLabels,
      writePrComments: raw.automation?.writePrComments ?? DEFAULT_POLICY.automation.writePrComments,
      createReleaseDrafts: raw.automation?.createReleaseDrafts ?? DEFAULT_POLICY.automation.createReleaseDrafts
    },
    ai: {
      enabled: aiProvider === "disabled" ? false : aiEnabled,
      provider: aiProvider
    },
    dataRetention: {
      rawContent: raw.dataRetention?.rawContent ?? DEFAULT_POLICY.dataRetention.rawContent,
      rawContentDays: raw.dataRetention?.rawContentDays ?? DEFAULT_POLICY.dataRetention.rawContentDays,
      analysisDays: raw.dataRetention?.analysisDays ?? DEFAULT_POLICY.dataRetention.analysisDays,
      auditLogDays: raw.dataRetention?.auditLogDays ?? DEFAULT_POLICY.dataRetention.auditLogDays
    },
    labels: {
      allowed: [...(raw.labels?.allowed ?? DEFAULT_POLICY.labels.allowed)]
    },
    policy: {
      requireSecurityMd: raw.policy?.requireSecurityMd ?? DEFAULT_POLICY.policy.requireSecurityMd,
      requireCodeowners: raw.policy?.requireCodeowners ?? DEFAULT_POLICY.policy.requireCodeowners,
      requireScorecard: raw.policy?.requireScorecard ?? DEFAULT_POLICY.policy.requireScorecard,
      minimumScorecardScore: raw.policy?.minimumScorecardScore ?? DEFAULT_POLICY.policy.minimumScorecardScore
    },
    release: {
      requireProvenance: raw.release?.requireProvenance ?? DEFAULT_POLICY.release.requireProvenance,
      blockOnUnresolvedAdvisory:
        raw.release?.blockOnUnresolvedAdvisory ?? DEFAULT_POLICY.release.blockOnUnresolvedAdvisory
    }
  };
}

export function parsePolicy(source: string): MaintainerOpsPolicy {
  const loaded = yaml.load(source) ?? {};
  const parsed = rawPolicySchema.parse(loaded);
  return mergePolicy(parsed);
}

export function validatePolicy(source: string): PolicyValidationResult {
  try {
    const policy = parsePolicy(source);
    return { valid: true, policy, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.issues.map((issue) => `${issue.path.join(".") || "policy"}: ${issue.message}`)
      };
    }

    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "Unknown policy parsing error"]
    };
  }
}

export function canPersistRawContent(policy: MaintainerOpsPolicy): boolean {
  return policy.dataRetention.rawContent && policy.dataRetention.rawContentDays > 0;
}

export function canSendContentToAi(policy: MaintainerOpsPolicy): boolean {
  return policy.ai.enabled && policy.ai.provider !== "disabled" && canPersistRawContent(policy);
}
