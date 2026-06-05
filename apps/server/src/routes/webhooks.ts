import type { FastifyInstance } from "fastify";
import { normalizeGitHubWebhook } from "@maintainerops/core";
import type { AppConfig } from "../config.js";
import { parseJsonBody, readRawBody } from "../services/body.js";
import { verifyGitHubSignature } from "../services/signature.js";
import type { MaintainerStore } from "../services/store.js";

export function registerWebhookRoutes(app: FastifyInstance, config: AppConfig, store: MaintainerStore): void {
  app.post("/webhooks/github", async (request, reply) => {
    const rawBody = readRawBody(request.body);
    const eventName = readHeader(request.headers["x-github-event"]);
    const deliveryId = readHeader(request.headers["x-github-delivery"]);
    const signature = readHeader(request.headers["x-hub-signature-256"]);

    if (!eventName || !deliveryId) {
      return reply.code(400).send({ error: "Missing GitHub event or delivery header." });
    }

    if (config.github.webhookSecret && !verifyGitHubSignature(rawBody, signature, config.github.webhookSecret)) {
      return reply.code(401).send({ error: "Invalid GitHub webhook signature." });
    }

    if (await store.hasDelivery(deliveryId)) {
      return reply.code(202).send({ accepted: false, duplicate: true, items: [] });
    }

    const payload = parseJsonBody(request.body);
    const items = normalizeGitHubWebhook({ eventName, deliveryId, payload });
    const result = await store.ingest(deliveryId, items, eventName);

    return reply.code(202).send({
      accepted: result.accepted,
      duplicate: false,
      count: result.items.length,
      items: result.items.map((item) => ({ id: item.id, kind: item.kind, title: item.title }))
    });
  });
}

function readHeader(value: string | string[] | undefined): string | undefined {
  const header = Array.isArray(value) ? (value.length === 1 ? value[0] : undefined) : value;
  if (typeof header !== "string") return undefined;
  const trimmed = header.trim();
  return trimmed.length > 0 && !trimmed.includes(",") ? trimmed : undefined;
}
