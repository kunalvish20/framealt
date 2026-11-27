import { createHmac, createPrivateKey, createSign, timingSafeEqual } from 'node:crypto';

export function signMuxPlaybackUrl(playbackId, audience, durationSeconds, keyId, privateKeyBase64, now = Date.now()) {
  const privateKey = createPrivateKey(Buffer.from(privateKeyBase64, 'base64'));
  const expiresIn = Math.max(7200, Math.ceil(durationSeconds) + 1800);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: playbackId, aud: audience, exp: Math.floor(now / 1000) + expiresIn, kid: keyId })).toString('base64url');
  const input = `${header}.${payload}`;
  const signature = createSign('RSA-SHA256').update(input).end().sign(privateKey).toString('base64url');
  const token = `${input}.${signature}`;
  return { url: audience === 'v' ? `https://stream.mux.com/${encodeURIComponent(playbackId)}.m3u8?token=${token}` : `https://image.mux.com/${encodeURIComponent(playbackId)}/thumbnail.jpg?token=${token}`, expiresIn };
}

export function verifyMuxSignature(body, signature, secret, now = Date.now()) {
  const fields = Object.fromEntries((signature || '').split(',').map(part => part.trim().split('=', 2)));
  const timestamp = Number(fields.t);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(now / 1000) - timestamp) > 300 || !/^[a-f0-9]{64}$/i.test(fields.v1 || '')) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest();
  return timingSafeEqual(expected, Buffer.from(fields.v1, 'hex'));
}
