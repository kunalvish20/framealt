export const MAX_UPLOAD_BYTES: number;
export const ALLOWED_MIME_PREFIXES: string[];
export function uploadKind(mime: string): 'video' | null;
export function validUpload(size: number, mime: string): boolean;
