import type { Asset, Version } from './types';
export function buildLibraryIndex(assets: Asset[], versions: Version[], approvals: { asset_version_id: string; status: string }[], defaults: readonly string[]): {
  latest: Map<string, Version>;
  counts: Map<string, number>;
  decisions: Map<string, string>;
  statuses: Map<string, string>;
  statusCounts: Map<string, number>;
  options: string[];
};
