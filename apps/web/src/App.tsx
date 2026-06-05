import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDot,
  GitPullRequest,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Tags
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type WorkItemKind = "pull_request" | "issue" | "release" | "security" | "policy";
type Priority = "low" | "normal" | "high" | "urgent";

interface Finding {
  id: string;
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  source: string;
  description: string;
  evidence?: string;
}

interface Recommendation {
  id: string;
  action: string;
  title: string;
  description: string;
  confidence: number;
  labels?: string[];
  requiresApproval: boolean;
}

export interface WorkItem {
  id: string;
  kind: WorkItemKind;
  status: string;
  repository: {
    fullName: string;
    private: boolean;
  };
  title: string;
  url?: string;
  number?: number;
  updatedAt: string;
  labels: string[];
  analysis: {
    summary: string;
    risk: {
      value: number;
      priority: Priority;
      factors: Array<{ id: string; label: string; points: number; severity: string }>;
    };
    findings: Finding[];
    recommendations: Recommendation[];
  };
}

interface QueueResponse {
  total: number;
  items: WorkItem[];
}

interface AuditEntry {
  id: string;
  occurredAt: string;
  actor: string;
  action: string;
  repository: string;
  outcome: string;
}

interface ScannerResult {
  scanner: "scorecard" | "osv-scanner";
  status: "completed" | "unavailable" | "failed";
  command: string;
  error?: string;
  json?: unknown;
}

interface MaintainerJob {
  id: string;
  type: "scan.scorecard" | "scan.osv";
  status: "queued" | "active" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  input: {
    repository?: string;
    path?: string;
  };
  result?: ScannerResult;
  error?: string;
}

interface AiAssistance {
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

interface PilotMetrics {
  repositories: number;
  workItems: {
    total: number;
    open: number;
    triaged: number;
    resolved: number;
  };
  recommendations: {
    total: number;
    approvalGated: number;
  };
  audit: {
    total: number;
    failed: number;
    applied: number;
  };
  jobs: {
    total: number;
    completed: number;
    failed: number;
  };
}

const API_BASE = import.meta.env.VITE_API_BASE || "";
const FILTERS: Array<{ kind: WorkItemKind | "all"; label: string }> = [
  { kind: "all", label: "All" },
  { kind: "pull_request", label: "PRs" },
  { kind: "issue", label: "Issues" },
  { kind: "policy", label: "Policy" },
  { kind: "security", label: "Security" },
  { kind: "release", label: "Release" }
];

export function App() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [filter, setFilter] = useState<WorkItemKind | "all">("all");
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [scanResult, setScanResult] = useState<ScannerResult | null>(null);
  const [jobs, setJobs] = useState<MaintainerJob[]>([]);
  const [aiAssistance, setAiAssistance] = useState<AiAssistance | null>(null);
  const [metrics, setMetrics] = useState<PilotMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const filteredItems = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.kind === filter)),
    [filter, items]
  );
  const selected = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0];
  const stats = useMemo(() => buildStats(items), [items]);

  async function loadQueue() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/queue?limit=100`);
      if (!response.ok) throw new Error(await readApiError(response, "Queue request failed"));
      const data = (await response.json()) as QueueResponse;
      setItems(data.items);
      setSelectedId((current) => current || data.items[0]?.id || "");

      const auditResponse = await fetch(`${API_BASE}/api/audit-log?limit=50`);
      if (auditResponse.ok) {
        const auditData = (await auditResponse.json()) as { entries: AuditEntry[] };
        setAudit(auditData.entries);
      }

      const jobsResponse = await fetch(`${API_BASE}/api/jobs?limit=20`);
      if (jobsResponse.ok) {
        const jobsData = (await jobsResponse.json()) as { items: MaintainerJob[] };
        setJobs(jobsData.items);
      }

      const metricsResponse = await fetch(`${API_BASE}/api/pilot/metrics`);
      if (metricsResponse.ok) {
        setMetrics((await metricsResponse.json()) as PilotMetrics);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load queue.");
    } finally {
      setLoading(false);
    }
  }

  async function recordAction(action: string) {
    if (!selected) return;

    const response = await fetch(`${API_BASE}/api/work-items/${encodeURIComponent(selected.id)}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, actor: "local-admin", dryRun: actionRequestDryRun(action) })
    });

    if (!response.ok) {
      setError(await readApiError(response, "Action failed"));
      return;
    }

    await loadQueue();
  }

  async function runScan(kind: "scorecard" | "osv") {
    if (!selected) return;
    setError("");
    setScanResult(null);

    const response = await fetch(`${API_BASE}/api/scans/${kind}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(kind === "scorecard" ? { repository: selected.repository.fullName } : { path: "." })
    });

    const data = (await response.json()) as ScannerResult | { error: string };
    if (!response.ok || "error" in data) {
      setError("error" in data ? data.error : `Scanner failed: ${response.status}`);
      return;
    }

    setScanResult(data);
  }

  async function enqueueScan(kind: "scorecard" | "osv") {
    if (!selected) return;
    setError("");

    const response = await fetch(`${API_BASE}/api/jobs/scans/${kind}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(kind === "scorecard" ? { repository: selected.repository.fullName } : { path: "." })
    });

    if (!response.ok) {
      setError(await readApiError(response, "Job enqueue failed"));
      return;
    }

    await loadQueue();
  }

  async function loadAiAssistance() {
    if (!selected) return;
    setError("");
    setAiAssistance(null);

    const response = await fetch(`${API_BASE}/api/work-items/${encodeURIComponent(selected.id)}/ai-assist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ includeRawContent: false })
    });

    const data = (await response.json()) as { assistance?: AiAssistance; error?: string };
    if (!response.ok || !data.assistance) {
      setError(data.error ?? (await readApiError(response, "AI assistance failed")));
      return;
    }

    setAiAssistance(data.assistance);
  }

  useEffect(() => {
    void loadQueue();
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">MaintainerOps</p>
          <h1>Maintainer queue</h1>
        </div>
        <button className="icon-button" type="button" onClick={() => void loadQueue()} aria-label="Refresh queue">
          <RefreshCw size={18} />
        </button>
      </header>

      <section className="stats-band" aria-label="Queue summary">
        <Metric label="Open" value={stats.open} tone="blue" />
        <Metric label="Urgent" value={stats.urgent} tone="red" />
        <Metric label="Security" value={stats.security} tone="amber" />
        <Metric label="Repos" value={stats.repositories} tone="green" />
      </section>

      <section className="workspace">
        <aside className="queue-pane" aria-label="Work queue">
          <div className="segmented" role="tablist" aria-label="Queue filters">
            {FILTERS.map((entry) => (
              <button
                key={entry.kind}
                className={filter === entry.kind ? "active" : ""}
                type="button"
                onClick={() => setFilter(entry.kind)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {loading ? <div className="empty-state">Loading queue</div> : null}
          {error ? <div className="error-state">{error}</div> : null}

          <div className="queue-list">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={selected?.id === item.id ? "queue-card selected" : "queue-card"}
                onClick={() => setSelectedId(item.id)}
              >
                <span className={`kind-icon ${item.kind}`}>
                  <KindIcon kind={item.kind} />
                </span>
                <span className="queue-card-main">
                  <span className="queue-title">{item.title}</span>
                  <span className="queue-meta">
                    {item.repository.fullName}
                    {item.number ? ` #${item.number}` : ""}
                  </span>
                </span>
                <span className={`priority ${item.analysis.risk.priority}`}>{item.analysis.risk.value}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="detail-pane" aria-label="Work item details">
          {selected ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">{selected.repository.fullName}</p>
                  <h2>{selected.title}</h2>
                </div>
                <span className={`status-pill ${selected.analysis.risk.priority}`}>{selected.analysis.risk.priority}</span>
              </div>

              <p className="summary">{selected.analysis.summary}</p>

              <div className="detail-grid">
                <section className="panel">
                  <h3>Risk factors</h3>
                  <div className="factor-list">
                    {selected.analysis.risk.factors.length > 0 ? (
                      selected.analysis.risk.factors.map((factor) => (
                        <div className="factor-row" key={factor.id}>
                          <span>{factor.label}</span>
                          <strong>+{factor.points}</strong>
                        </div>
                      ))
                    ) : (
                      <div className="muted">No risk factors detected</div>
                    )}
                  </div>
                </section>

                <section className="panel">
                  <h3>Recommendations</h3>
                  <div className="recommendation-list">
                    {selected.analysis.recommendations.map((recommendation) => (
                      <article className="recommendation" key={recommendation.id}>
                        <div>
                          <strong>{recommendation.title}</strong>
                          <p>{recommendation.description}</p>
                        </div>
                        <span>{Math.round(recommendation.confidence * 100)}%</span>
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              <section className="panel full-width">
                <div className="panel-title-row">
                  <h3>AI maintainer preview</h3>
                  <div className="compact-actions">
                    <button type="button" onClick={() => void loadAiAssistance()}>
                      <Bot size={16} />
                      Generate
                    </button>
                  </div>
                </div>
                {aiAssistance ? (
                  <article className={aiAssistance.enabled ? "ai-preview enabled" : "ai-preview disabled"}>
                    <strong>{aiAssistance.enabled ? `${aiAssistance.provider} · ${aiAssistance.model}` : "AI disabled"}</strong>
                    <p>{aiAssistance.summary}</p>
                    <div className="ai-columns">
                      <MiniList title="Rationale" items={aiAssistance.rationale} />
                      <MiniList title="Actions" items={aiAssistance.suggestedActions} />
                      <MiniList title="Safety" items={aiAssistance.safetyNotes} />
                    </div>
                  </article>
                ) : (
                  <div className="muted">No AI preview generated in this session</div>
                )}
              </section>

              <section className="panel full-width">
                <h3>Findings</h3>
                <div className="finding-list">
                  {selected.analysis.findings.length > 0 ? (
                    selected.analysis.findings.map((finding) => (
                      <article className={`finding ${finding.severity}`} key={finding.id}>
                        <AlertTriangle size={18} />
                        <div>
                          <strong>{finding.title}</strong>
                          <p>{finding.description}</p>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="muted">No findings attached</div>
                  )}
                </div>
              </section>

              <section className="panel full-width">
                <div className="panel-title-row">
                  <h3>Security scans</h3>
                  <div className="compact-actions">
                    <button type="button" onClick={() => void enqueueScan("scorecard")}>
                      <ShieldCheck size={16} />
                      Queue Scorecard
                    </button>
                    <button type="button" onClick={() => void enqueueScan("osv")}>
                      <Search size={16} />
                      Queue OSV
                    </button>
                    <button type="button" onClick={() => void runScan("scorecard")}>
                      <ShieldCheck size={16} />
                      Run now
                    </button>
                    <button type="button" onClick={() => void runScan("osv")}>
                      <Search size={16} />
                      OSV now
                    </button>
                  </div>
                </div>
                {scanResult ? (
                  <div className={`scan-result ${scanResult.status}`}>
                    <strong>
                      {scanResult.scanner}: {scanResult.status}
                    </strong>
                    <span>{scanResult.error ?? scanSummary(scanResult.json)}</span>
                  </div>
                ) : (
                  <div className="muted">No scan has been run in this session</div>
                )}
              </section>

              <footer className="action-bar">
                <button type="button" onClick={() => void recordAction("triage")}>
                  <Tags size={17} />
                  Mark triaged
                </button>
                <button type="button" onClick={() => void recordAction("write_check")}>
                  <CheckCircle2 size={17} />
                  Record check
                </button>
                <button type="button" onClick={() => void recordAction("resolve")}>
                  <ShieldCheck size={17} />
                  Resolve
                </button>
              </footer>
            </>
          ) : (
            <div className="empty-state">No work items</div>
          )}
        </section>

        <aside className="audit-pane" aria-label="Audit log">
          <h3>Pilot metrics</h3>
          {metrics ? (
            <div className="metric-stack">
              <MetricRow label="Work items" value={metrics.workItems.total} />
              <MetricRow label="Open" value={metrics.workItems.open} />
              <MetricRow label="Recommendations" value={metrics.recommendations.total} />
              <MetricRow label="Jobs" value={metrics.jobs.total} />
            </div>
          ) : (
            <div className="muted">Metrics unavailable</div>
          )}
          <h3>Jobs</h3>
          <div className="job-list">
            {jobs.length > 0 ? (
              jobs.slice(0, 6).map((job) => (
                <article className={`job-entry ${job.status}`} key={job.id}>
                  <strong>{job.type.replace("scan.", "")}</strong>
                  <span>{job.status}</span>
                  <small>{new Date(job.updatedAt).toLocaleString()}</small>
                </article>
              ))
            ) : (
              <div className="muted">No background jobs</div>
            )}
          </div>
          <h3>Audit log</h3>
          <div className="audit-list">
            {audit.length > 0 ? (
              audit.slice(0, 8).map((entry) => (
                <article className="audit-entry" key={entry.id}>
                  <strong>{entry.action}</strong>
                  <span>{entry.actor}</span>
                  <small>{new Date(entry.occurredAt).toLocaleString()}</small>
                </article>
              ))
            ) : (
              <div className="muted">No actions recorded</div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function Metric(props: { label: string; value: number; tone: "blue" | "red" | "amber" | "green" }) {
  return (
    <div className={`metric ${props.tone}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function MetricRow(props: { label: string; value: number }) {
  return (
    <div className="metric-row">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function MiniList(props: { title: string; items: string[] }) {
  return (
    <div className="mini-list">
      <strong>{props.title}</strong>
      {props.items.length > 0 ? (
        <ul>
          {props.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <span className="muted">No items</span>
      )}
    </div>
  );
}

function KindIcon(props: { kind: WorkItemKind }) {
  switch (props.kind) {
    case "pull_request":
      return <GitPullRequest size={18} />;
    case "issue":
      return <CircleDot size={18} />;
    case "release":
      return <Rocket size={18} />;
    case "security":
    case "policy":
      return <ShieldCheck size={18} />;
  }
}

export function actionRequestDryRun(action: string): boolean {
  return action !== "triage" && action !== "resolve";
}

export function buildStats(items: WorkItem[]) {
  return {
    open: items.filter((item) => item.status === "open").length,
    urgent: items.filter((item) => item.analysis.risk.priority === "urgent").length,
    security: items.filter((item) => item.kind === "security" || item.labels.includes("security")).length,
    repositories: new Set(items.map((item) => item.repository.fullName)).size
  };
}

export function scanSummary(json: unknown): string {
  if (!json || typeof json !== "object") {
    return "Scanner returned no JSON summary";
  }

  const record = json as Record<string, unknown>;
  if (typeof record.score === "number") {
    return `Score ${record.score}`;
  }
  if (Array.isArray(record.results)) {
    return `${record.results.length} result groups`;
  }
  return "Scanner completed with JSON output";
}

export async function readApiError(response: Response, fallback: string): Promise<string> {
  const statusMessage = `${fallback}: ${response.status}`;
  try {
    const body = (await response.json()) as { error?: unknown; message?: unknown };
    if (typeof body.error === "string" && body.error.length > 0) return body.error;
    if (typeof body.message === "string" && body.message.length > 0) return body.message;
    return statusMessage;
  } catch {
    return statusMessage;
  }
}
