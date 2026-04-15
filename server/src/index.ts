import Fastify from "fastify";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deserializeProjectSnapshot,
  serializeProjectSnapshot,
} from "../../src/app/backend/validation";
import { ProjectStore } from "./store";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = `${__dirname}/../data`;
mkdirSync(dataDir, { recursive: true });

const store = new ProjectStore(`${dataDir}/sparecircle.db`);
const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, service: "sparecircle-backend" }));

app.get<{ Params: { projectId: string } }>("/api/projects/:projectId", async (request, reply) => {
  const { projectId } = request.params;
  const record = store.load(projectId);
  if (!record) {
    reply.code(404);
    return { ok: false, error: "Project not found" };
  }

  const parsed = deserializeProjectSnapshot(record.serializedProject);
  if (!parsed.ok) {
    reply.code(500);
    return { ok: false, error: `Stored project is invalid: ${parsed.error}` };
  }

  return {
    ok: true,
    projectId,
    project: parsed.project,
    updatedAt: record.updatedAt,
    warning: parsed.warning,
  };
});

app.put<{ Params: { projectId: string }; Body: { project: unknown } }>("/api/projects/:projectId", async (request, reply) => {
  const { projectId } = request.params;
  const serializedInput = JSON.stringify(request.body?.project ?? null);
  const parsed = deserializeProjectSnapshot(serializedInput);

  if (!parsed.ok) {
    reply.code(400);
    return { ok: false, error: parsed.error };
  }

  const normalized = serializeProjectSnapshot(parsed.project);
  const record = store.save(projectId, normalized);

  return {
    ok: true,
    projectId,
    updatedAt: record.updatedAt,
    warning: parsed.warning,
  };
});

const start = async () => {
  try {
    await app.listen({ host: HOST, port: PORT });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
