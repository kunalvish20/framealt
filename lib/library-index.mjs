/** Linear-time indexes reused while searching/filtering a large library. */
export function buildLibraryIndex(assets, versions, approvals, defaults) {
  const latest = new Map(), counts = new Map(), decisions = new Map(), statuses = new Map(), statusCounts = new Map();
  for (const version of versions) {
    if (version.status !== 'ready') continue;
    counts.set(version.asset_id, (counts.get(version.asset_id) || 0) + 1);
    if (!latest.has(version.asset_id) || latest.get(version.asset_id).version < version.version) latest.set(version.asset_id, version);
  }
  for (const approval of approvals) {
    const previous = decisions.get(approval.asset_version_id);
    if (previous !== 'Changes requested') decisions.set(approval.asset_version_id, approval.status === 'changes_requested' ? 'Changes requested' : 'Approved');
  }
  const options = [...new Set([...defaults, ...assets.map(asset => asset.workflow_status).filter(Boolean)])];
  for (const asset of assets) {
    const decision = decisions.get(latest.get(asset.id)?.id) || 'In review';
    const status = asset.workflow_status || (decision === 'Approved' ? 'Approved' : decision === 'Changes requested' ? 'Attention' : 'Needs Review');
    statuses.set(asset.id, status);
    if (asset.current_version > 0) statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  }
  return { latest, counts, decisions, statuses, statusCounts, options };
}
