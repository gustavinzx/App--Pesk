import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { LocalFotoStorage } from './LocalFotoStorage.js';

test('local photo storage saves, retrieves, and deletes a photo', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pesk-photos-'));
  const storage = new LocalFotoStorage(
    directory,
    'http://localhost:3000/uploads'
  );

  try {
    const saved = await storage.salvar(
      'desafios/desafio-1/registros/registro-1',
      'aGVsbG8=',
      'image/jpeg'
    );
    assert.match(saved.url, /^http:\/\/localhost:3000\/uploads\//);
    assert.match(saved.path, /\.jpg$/);

    const photo = await storage.obter(saved.path);
    assert.ok(photo);
    assert.equal(photo.contentType, 'image/jpeg');
    assert.equal(Buffer.from(photo.bytes).toString('utf8'), 'hello');

    await storage.excluir(saved.path);
    assert.equal(await storage.obter(saved.path), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('local photo storage rejects unsupported MIME types and external URLs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pesk-photos-'));
  const storage = new LocalFotoStorage(
    directory,
    'http://localhost:3000/uploads'
  );
  try {
    await assert.rejects(
      storage.salvar('photo', 'aGVsbG8=', 'application/octet-stream'),
      /Formato de foto não suportado/
    );
    await assert.rejects(
      storage.excluir('https://example.com/secret.jpg'),
      /não pertence ao armazenamento local/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
