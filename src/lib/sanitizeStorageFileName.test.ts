import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizeStorageFileName } from './sanitizeStorageFileName.ts';

test('converts accented and unsafe characters to a Storage-safe filename', () => {
  assert.equal(
    sanitizeStorageFileName('O_Método/Previsível vídeo.mp4'),
    'O_Metodo_Previsivel_video.mp4',
  );
});
