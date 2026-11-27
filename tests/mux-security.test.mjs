import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync, verify } from 'node:crypto';
import { signMuxPlaybackUrl, verifyMuxSignature } from '../lib/mux-crypto.mjs';

test('Mux playback URL contains a valid RS256 video token with bounded access', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const secret = Buffer.from(privateKey.export({ format: 'pem', type: 'pkcs1' })).toString('base64');
  const now = 1_700_000_000_000;
  const { url, expiresIn } = signMuxPlaybackUrl('playback-id', 'v', 3600, 'key-id', secret, now);
  const token = new URL(url).searchParams.get('token');
  assert.ok(token);
  const [header, payload, signature] = token.split('.');
  assert.equal(JSON.parse(Buffer.from(header, 'base64url')).kid, 'key-id');
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url')), {
    sub: 'playback-id', aud: 'v', exp: now / 1000 + expiresIn, kid: 'key-id',
  });
  assert.ok(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url')));
  assert.equal(new URL(url).hostname, 'stream.mux.com');
});

test('Mux webhook signature rejects forged, changed and stale requests', () => {
  const body = '{"type":"video.asset.ready"}';
  const secret = 'local-test-secret';
  const now = 1_700_000_000_000;
  const timestamp = now / 1000;
  const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const header = `t=${timestamp},v1=${digest}`;
  assert.equal(verifyMuxSignature(body, header, secret, now), true);
  assert.equal(verifyMuxSignature(body + ' ', header, secret, now), false);
  assert.equal(verifyMuxSignature(body, header, 'wrong-secret', now), false);
  assert.equal(verifyMuxSignature(body, header, secret, now + 301_000), false);
});
