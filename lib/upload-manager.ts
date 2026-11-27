'use client';

import { useSyncExternalStore } from 'react';
import { uploadMedia } from './upload-client';
import { supabaseBrowser } from './supabase-browser';
import { readableError } from './utils';

export type UploadJob = {
  id: string;
  userId: string;
  projectId: string;
  assetId?: string;
  versionId?: string;
  name: string;
  size: number;
  percent: number;
  stage: 'queued' | 'preparing' | 'uploading' | 'processing' | 'ready' | 'failed';
  error?: string;
};

let jobs: UploadJob[] = [];
let queue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
const serverSnapshot: UploadJob[] = [];

function publish(next: UploadJob[]) {
  jobs = next;
  listeners.forEach(listener => listener());
}

function update(id: string, changes: Partial<UploadJob>) {
  publish(jobs.map(job => job.id === id ? { ...job, ...changes } : job));
}

export function subscribeUploads(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const getUploads = () => jobs;
export function useUploads() {
  return useSyncExternalStore(subscribeUploads, getUploads, () => serverSnapshot);
}

export function dismissUpload(id: string) {
  publish(jobs.filter(job => job.id !== id || !['ready', 'failed'].includes(job.stage)));
}

export function dismissUploadsForAsset(assetId: string, versionId?: string) {
  publish(jobs.filter(job => job.assetId !== assetId || (versionId && job.versionId !== versionId) || !['ready', 'failed'].includes(job.stage)));
}

async function watchProcessing(jobId: string, versionId: string) {
  // The webhook finishes processing on the server. This only updates the open tab.
  for (let attempt = 0; attempt < 240; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 15000));
    if (!jobs.some(job => job.id === jobId && job.stage === 'processing')) return;
    const { data, error } = await supabaseBrowser().from('asset_versions').select('status').eq('id', versionId).maybeSingle();
    if (error) continue;
    if (data?.status === 'ready') { update(jobId, { stage: 'ready', percent: 100 }); return; }
    if (!data) { update(jobId, { stage: 'failed', error: 'Mux could not process this video. Please retry.' }); return; }
  }
}

export function queueMuxUploads(files: File[], projectId: string, userId: string, assetId?: string) {
  const added = files.map(file => ({
    id: crypto.randomUUID(), userId, projectId, assetId, name: file.name, size: file.size,
    percent: 0, stage: 'queued' as const,
  }));
  publish([...jobs, ...added]);
  for (const [index, file] of files.entries()) {
    const job = added[index];
    queue = queue.catch(() => {}).then(async () => {
      update(job.id, { stage: 'preparing' });
      try {
        const result = await uploadMedia(file, projectId,
          (percent, phase) => update(job.id, { percent, stage: phase }),
          assetId,
          (startedAssetId, versionId) => update(job.id, { assetId: startedAssetId, versionId }),
        );
        update(job.id, { assetId: result.assetId, versionId: result.versionId, percent: 100, stage: result.processing ? 'processing' : 'ready' });
        if (result.processing) void watchProcessing(job.id, result.versionId);
      } catch (error) {
        update(job.id, { stage: 'failed', error: readableError(error) });
      }
    });
  }
  return added.map(job => job.id);
}
