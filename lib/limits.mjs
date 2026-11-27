export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024 * 1024;
export const ALLOWED_MIME_PREFIXES = ['video/'];
export function uploadKind(mime) {
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) ? mime.split('/')[0] : null;
}
export function validUpload(size, mime) {
  return Number.isSafeInteger(size) && size > 0 && size <= MAX_UPLOAD_BYTES && !!uploadKind(mime);
}
