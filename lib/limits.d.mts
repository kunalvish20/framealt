export const SMALL_UPLOAD_THRESHOLD: number;
export const MULTIPART_PART_SIZE: number;
export const MAX_UPLOAD_BYTES: number;
export const MAX_PARTS: number;
export const ALLOWED_MIME_PREFIXES: string[];
export function uploadKind(mime: string): 'image' | 'video' | 'audio' | null;
export function validUpload(size: number, mime: string): boolean;
