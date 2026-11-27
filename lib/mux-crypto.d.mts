export function signMuxPlaybackUrl(playbackId: string, audience: 'v' | 't', durationSeconds: number, keyId: string, privateKeyBase64: string, now?: number): { url: string; expiresIn: number };
export function verifyMuxSignature(body: string, signature: string | null, secret: string, now?: number): boolean;
