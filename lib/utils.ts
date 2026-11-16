export function fmtTime(seconds: number) {
  const n = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(n / 3600) > 0 ? `${Math.floor(n / 3600)}:` : ''}${String(Math.floor((n % 3600) / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}
export function fmtBytes(b: number) {
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB','TB'];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
  return `${(b / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}
export function initials(s: string) {
  return (s || 'U').trim().split(/\s+/).map(p => p[0]).join('').slice(0,2).toUpperCase();
}
export function readableError(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong';
}
