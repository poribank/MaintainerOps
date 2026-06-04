CREATE TABLE installations (
  id BIGINT PRIMARY KEY,
  account_login TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE repositories (
  id BIGINT PRIMARY KEY,
  installation_id BIGINT REFERENCES installations(id),
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL UNIQUE,
  is_private BOOLEAN NOT NULL,
  default_branch TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webhook_deliveries (
  delivery_id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  repository_full_name TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE work_items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  repository_full_name TEXT NOT NULL REFERENCES repositories(full_name),
  title TEXT NOT NULL,
  external_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  repository_full_name TEXT NOT NULL,
  work_item_id TEXT REFERENCES work_items(id),
  delivery_id TEXT,
  dry_run BOOLEAN NOT NULL,
  github_request_id TEXT,
  outcome TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX work_items_repository_status_idx ON work_items (repository_full_name, status);
CREATE INDEX work_items_kind_status_idx ON work_items (kind, status);
CREATE INDEX work_items_risk_idx ON work_items (((payload->'analysis'->'risk'->>'value')::int));
CREATE INDEX audit_log_repository_occurred_idx ON audit_log (repository_full_name, occurred_at DESC);
CREATE INDEX webhook_deliveries_repository_received_idx ON webhook_deliveries (repository_full_name, received_at DESC);
