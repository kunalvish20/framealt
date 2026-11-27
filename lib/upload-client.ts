import * as UpChunk from '@mux/upchunk';
import { authFetch } from './supabase-browser';

async function videoDuration(file: File): Promise<number | undefined> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file), video = document.createElement('video');
    let settled = false;
    const finish = (value?: number) => {
      if (settled) return;
      settled = true;
      video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); resolve(value);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined);
    video.onerror = () => finish();
    video.src = url;
    setTimeout(() => finish(), 5000);
  });
}

type UploadPhase = 'uploading' | 'processing';
type ProgressCallback = (percent: number, phase: UploadPhase) => void;

function transferToMux(file: File, url: string, onProgress: ProgressCallback) {
  return new Promise<void>((resolve, reject) => {
    const upload = UpChunk.createUpload({ endpoint: url, file, chunkSize: 30720 });
    upload.on('progress', event => onProgress(Math.min(100, Math.max(0, Math.round(event.detail))), 'uploading'));
    upload.on('error', event => reject(new Error(event.detail.message || 'Mux upload failed.')));
    upload.on('success', () => resolve());
  });
}

export async function uploadMedia(file: File, projectId: string, onProgress: ProgressCallback, assetId?: string, onStarted?: (assetId: string, versionId: string) => void): Promise<{ assetId: string; versionId: string; processing: boolean }> {
  if (!file.type.startsWith('video/')) throw new Error('Mux cloud upload accepts videos only. Link images or audio from Google Drive.');
  const durationSeconds = await videoDuration(file);
  const start = await authFetch('/api/upload/start', { method: 'POST', body: JSON.stringify({
    fileName: file.name, size: file.size, mimeType: file.type, projectId, assetId, durationSeconds,
  }) });
  onStarted?.(start.assetId, start.versionId);
  try {
    onProgress(0, 'uploading');
    await transferToMux(file, start.uploadUrl, onProgress);
  } catch (error) {
    await authFetch('/api/upload/abort', { method: 'POST', body: JSON.stringify({ versionId: start.versionId }) }).catch(() => {});
    throw error;
  }
  onProgress(100, 'processing');
  // Mux has accepted the upload, but encoding is asynchronous. Webhooks finish it
  // even when this browser closes; polling gives the uploader immediate feedback.
  for (let attempt = 0; attempt < 48; attempt++) {
    const result = await authFetch('/api/upload/complete', { method: 'POST', body: JSON.stringify({ versionId: start.versionId }) });
    if (result.ready) {
      onProgress(100, 'processing');
      return { assetId: start.assetId, versionId: start.versionId, processing: false };
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  onProgress(100, 'processing');
  return { assetId: start.assetId, versionId: start.versionId, processing: true };
}
