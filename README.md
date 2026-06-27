# st-anamnesis-engine

Redis-backed knowledge graph builder for git repositories.

- Accepts git-repo build requests over HTTP and immediately returns `202 Accepted`.
- Queues jobs in Redis via BullMQ and processes them via a single-concurrency worker.
- Clones the repository, extracts an AST knowledge graph, runs community detection, persists the graph to Redis keyed by `companyId`, then calls a notification webhook.

## Extension seams

- **New language grammars:** implement the `Extractor` interface and register in `src/extract/Extractor.ts`.
- **OpenAI verifier:** implement the `GraphVerifier` interface and replace the default `NoopVerifier`.
- **MCP tools:** mount a read-only MCP server in `src/mcp/index.ts` wrapping `GraphQueryService`.

## Quick start

```bash
cp .env.example .env
# edit .env with your Redis host

npm install
npm run build

# terminal 1: API
npm run start:api

# terminal 2: worker
npm run start:worker
```

## API

```bash
POST /graph/build
{
  "companyId": "acme-corp",
  "gitHubRepo": "https://github.com/acme/project.git",
  "gitUsername": "git",
  "gitPassword": "ghp_...",
  "filesToExclude": ["node_modules/", "dist/"],
  "notifyUrl": "https://acme.com/api/graph-ready"
}
# -> 202 {"status":"queued","jobId":"..."}

GET /status/:jobId
# -> {"jobId":"...","state":"completed|failed|...","companyId":"..."}
```
