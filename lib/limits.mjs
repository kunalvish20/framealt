export const SMALL_UPLOAD_THRESHOLD = 100 * 1024 * 1024;
export const MULTIPART_PART_SIZE = 50 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024 * 1024;
export const MAX_PARTS = 10000;
export const ALLOWED_MIME_PREFIXES = ['video/', 'image/', 'audio/'];
export function uploadKind(mime) {
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) ? mime.split('/')[0] : null;
}
export function validUpload(size, mime) {
  return Number.isSafeInteger(size) && size > 0 && size <= MAX_UPLOAD_BYTES && !!uploadKind(mime);
}
