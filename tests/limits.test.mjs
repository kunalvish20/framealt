import test from 'node:test';
import assert from 'node:assert/strict';
import { SMALL_UPLOAD_THRESHOLD,MULTIPART_PART_SIZE,MAX_UPLOAD_BYTES,MAX_PARTS,uploadKind,validUpload } from '../lib/limits.mjs';
test('media MIME allowlist',()=>{
 assert.equal(uploadKind('video/mp4'),'video');assert.equal(uploadKind('image/png'),'image');assert.equal(uploadKind('audio/mpeg'),'audio');
 assert.equal(uploadKind('application/pdf'),null);assert.equal(uploadKind('text/html'),null);
});
test('reject invalid upload sizes',()=>{
 for(const n of [-1,0,NaN,Infinity,MAX_UPLOAD_BYTES+1,1.5])assert.equal(validUpload(n,'video/mp4'),false);
 assert.equal(validUpload(1024,'video/mp4'),true);
 assert.equal(validUpload(1024,'application/javascript'),false);
});
test('multipart configuration is S3-compatible',()=>{
 assert.ok(MULTIPART_PART_SIZE>=5*1024*1024);
 assert.ok(SMALL_UPLOAD_THRESHOLD<MULTIPART_PART_SIZE*MAX_PARTS);
 assert.ok(Math.ceil(MAX_UPLOAD_BYTES/MULTIPART_PART_SIZE)<=MAX_PARTS);
});
