import test from 'node:test';
import assert from 'node:assert/strict';
import { orderFolderVideos } from '../lib/drive-versions.mjs';

test('folder videos become V1 onward in Drive creation order', () => {
  const files = [
    { id: 'new', mimeType: 'video/mp4', createdTime: '2026-01-03T10:00:00Z' },
    { id: 'folder', mimeType: 'application/vnd.google-apps.folder' },
    { id: 'old', mimeType: 'video/mp4', createdTime: '2026-01-01T10:00:00Z' },
    { id: 'middle', mimeType: 'video/mp4', createdTime: '2026-01-02T10:00:00Z' },
    { id: 'old', mimeType: 'video/mp4', createdTime: '2026-01-01T10:00:00Z' },
  ];
  assert.deepEqual(orderFolderVideos(files).map(file => file.id), ['old', 'middle', 'new']);
});

test('equal timestamps have stable order across pagination', () => {
  const files = [
    { id: 'b', mimeType: 'video/mp4', createdTime: '2026-01-01T10:00:00Z' },
    { id: 'a', mimeType: 'video/mp4', createdTime: '2026-01-01T10:00:00Z' },
  ];
  assert.deepEqual(orderFolderVideos(files).map(file => file.id), ['a', 'b']);
});
