import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_UPLOAD_BYTES,uploadKind,validUpload } from '../lib/limits.mjs';
test('Mux upload accepts video MIME only',()=>{
 assert.equal(uploadKind('video/mp4'),'video');assert.equal(uploadKind('image/png'),null);assert.equal(uploadKind('audio/mpeg'),null);
 assert.equal(uploadKind('application/pdf'),null);assert.equal(uploadKind('text/html'),null);
});
test('reject invalid upload sizes',()=>{
 for(const n of [-1,0,NaN,Infinity,MAX_UPLOAD_BYTES+1,1.5])assert.equal(validUpload(n,'video/mp4'),false);
 assert.equal(validUpload(1024,'video/mp4'),true);
 assert.equal(validUpload(1024,'application/javascript'),false);
});
