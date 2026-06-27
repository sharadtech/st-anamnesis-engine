import { Config } from '../config/Config.js';
import type { GraphMeta } from '../types/Extraction.js';

export interface NotifyContext {
  companyId: string;
  jobId?: string;
  meta: GraphMeta;
}

export async function notifyWebhook(url: string, context: NotifyContext): Promise<void> {
  if (!Config.notifier.enabled) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Config.notifier.timeoutMs);

    const body = {
      companyId: context.companyId,
      jobId: context.jobId,
      status: context.meta.state,
      nodes: context.meta.nodes,
      edges: context.meta.edges,
      communities: context.meta.communities,
      gitCommit: context.meta.gitCommit,
      error: context.meta.error,
      updatedAt: context.meta.updatedAt,
    };

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch (err) {
    // Notification failures must not fail the build job.
    console.error(`[notifier] failed to notify ${url}:`, err);
  }
}
