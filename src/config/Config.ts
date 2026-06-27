function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`Invalid integer env var ${name}=${raw}`);
  return n;
}

function envString(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : raw;
}

function envStringOptional(name: string): string | undefined {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? undefined : raw;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

export const Config = {
  redis: {
    host: envString('REDIS_HOST', '127.0.0.1'),
    port: envInt('REDIS_PORT', 6379),
    db: envInt('REDIS_DB', 0),
    password: envString('REDIS_PASSWORD', '') || undefined,
    namespace: envString('REDIS_NAMESPACE', 'st-anamnesis'),
  },
  api: {
    host: envString('HOST', '127.0.0.1'),
    port: envInt('PORT', 3000),
  },
  worker: {
    concurrency: envInt('WORKER_CONCURRENCY', 1),
    attempts: envInt('WORKER_ATTEMPTS', 3),
    cloneTimeoutMs: envInt('CLONE_TIMEOUT_MS', 120_000),
    buildTimeoutMs: envInt('BUILD_TIMEOUT_MS', 600_000),
    workspaceRoot: envString('WORKSPACE_ROOT', '/var/lib/st-anamnesis/repos'),
  },
  verifier: {
    enabled: envBool('VERIFIER_ENABLED', false),
    apiKey: envString('OPENAI_API_KEY', ''),
    model: envString('OPENAI_MODEL', 'gpt-4o-mini'),
    baseUrl: envStringOptional('OPENAI_BASE_URL'),
    sampleSize: envInt('VERIFIER_SAMPLE_SIZE', 50),
    snippetLines: envInt('VERIFIER_SNIPPET_LINES', 10),
    timeoutMs: envInt('VERIFIER_TIMEOUT_MS', 60_000),
  },
  mcp: {
    enabled: envBool('MCP_ENABLED', true),
    apiKey: envString('MCP_API_KEY', ''),
  },
  notifier: {
    timeoutMs: envInt('NOTIFIER_TIMEOUT_MS', 10_000),
    enabled: envBool('NOTIFIER_ENABLED', true),
  },
};
