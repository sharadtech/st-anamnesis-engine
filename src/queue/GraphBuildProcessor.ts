import path from 'path';
import fs from 'fs/promises';
import { simpleGit } from 'simple-git';
import type { Job } from 'bullmq';

import { extractRepo } from '../extract/ExtractFile.js';
import { buildGraph, graphToSerialized } from '../graph/GraphBuilder.js';
import { clusterGraph } from '../graph/Cluster.js';
import { GraphRepository } from '../graph/GraphRepository.js';
import type { GraphBuildPayload, GraphMeta } from '../types/Extraction.js';
import type { GraphVerifier } from '../verify/GraphVerifier.js';
import { VerificationRepository } from '../verify/VerificationRepository.js';
import { notifyWebhook } from './Notifier.js';
import { Config } from '../config/Config.js';

export interface GraphBuildProcessorDependencies {
  repository: GraphRepository;
  verifier: GraphVerifier;
  verificationRepository?: VerificationRepository;
}

function normalizeUrl(repoUrl: string, username?: string, password?: string): string {
  if (!username && !password) return repoUrl;

  try {
    const url = new URL(repoUrl);
    if (!url.username && password) {
      url.username = encodeURIComponent(username ?? 'git');
      url.password = encodeURIComponent(password);
    } else if (url.username && password && !url.password) {
      url.password = encodeURIComponent(password);
    }
    return url.toString();
  } catch {
    return repoUrl;
  }
}

export function createGraphBuildProcessor(deps: GraphBuildProcessorDependencies) {
  return async function processGraphBuildJob(job: Job<GraphBuildPayload>): Promise<GraphMeta> {
    const payload = job.data;
    const workspaceDir = path.join(Config.worker.workspaceRoot, payload.companyId);
    const now = new Date().toISOString();

    const baseMeta: GraphMeta = {
      companyId: payload.companyId,
      state: 'active',
      jobId: job.id,
      nodes: 0,
      edges: 0,
      communities: 0,
      updatedAt: now,
    };

    await deps.repository.saveMeta(payload.companyId, baseMeta);

    try {
      // Prepare workspace
      if (payload.cleanWorkspace !== false) {
        await fs.rm(workspaceDir, { recursive: true, force: true });
      }
      await fs.mkdir(workspaceDir, { recursive: true });

      // Clone
      const cloneUrl = normalizeUrl(payload.gitHubRepo, payload.gitUsername, payload.gitPassword);
      const git = simpleGit(workspaceDir);
      if (payload.cleanWorkspace !== false) {
        await git.clone(cloneUrl, workspaceDir, ['--depth', '1']);
      } else {
        await git.pull();
      }

      const commit = await git.revparse(['HEAD']);

      // Extract
      const extraction = await extractRepo(workspaceDir, payload.filesToExclude ?? []);

      // Build graph + cluster
      const graph = buildGraph({ companyId: payload.companyId, extraction });
      const cluster = clusterGraph(graph);
      const serialized = graphToSerialized(graph, payload.companyId);

      // Verify (default no-op; OpenAI verifier when enabled)
      const report = await deps.verifier.verify(workspaceDir, serialized);
      if (deps.verificationRepository) {
        await deps.verificationRepository.saveReport(payload.companyId, report);
      }

      // Persist
      await deps.repository.saveGraph(payload.companyId, serialized);

      const completedMeta: GraphMeta = {
        companyId: payload.companyId,
        state: 'completed',
        jobId: job.id,
        nodes: serialized.nodes.length,
        edges: serialized.edges.length,
        communities: cluster.communities,
        gitCommit: commit.trim(),
        verified: report.verified,
        updatedAt: new Date().toISOString(),
      };

      await deps.repository.saveMeta(payload.companyId, completedMeta);

      if (payload.notifyUrl) {
        await notifyWebhook(payload.notifyUrl, { companyId: payload.companyId, jobId: job.id, meta: completedMeta });
      }

      return completedMeta;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedMeta: GraphMeta = {
        companyId: payload.companyId,
        state: 'failed',
        jobId: job.id,
        nodes: 0,
        edges: 0,
        communities: 0,
        error: message,
        updatedAt: new Date().toISOString(),
      };
      await deps.repository.saveMeta(payload.companyId, failedMeta);

      if (payload.notifyUrl) {
        await notifyWebhook(payload.notifyUrl, { companyId: payload.companyId, jobId: job.id, meta: failedMeta });
      }

      throw error;
    }
  };
}
