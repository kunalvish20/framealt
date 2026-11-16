export const WORKFLOW_STATUSES = [
  'Needs Review',
  'In Progress',
  'Approved',
  'Attention',
  'Discard',
  'Uploaded',
  'best performing video',
  '1st Level Check',
] as const;

export function statusTone(status: string) {
  switch (status) {
    case 'Needs Review': return 'neutral';
    case 'In Progress': return 'blue';
    case 'Approved': return 'green';
    case 'Attention': return 'purple';
    case 'Discard': return 'muted';
    case 'Uploaded': return 'violet';
    case 'best performing video': return 'pink';
    case '1st Level Check': return 'pink';
    default: return 'custom';
  }
}
