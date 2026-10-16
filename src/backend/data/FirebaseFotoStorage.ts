import type { App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import type { FotoStoragePort } from '../../core/business/ports/PescariaRepository.js';

export class FirebaseFotoStorage implements FotoStoragePort {
  private readonly bucket;

  constructor(app: App, bucketName?: string) {
    this.bucket = getStorage(app).bucket(bucketName);
  }

  async salvar(
    path: string,
    base64: string,
    contentType: string
  ): Promise<string> {
    const token = randomUUID();
    const file = this.bucket.file(path);
    await file.save(Buffer.from(base64, 'base64'), {
      resumable: false,
      metadata: {
        contentType,
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    return `https://firebasestorage.googleapis.com/v0/b/${this.bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  }

  async excluir(path: string): Promise<void> {
    await this.bucket.file(path).delete({ ignoreNotFound: true });
  }
}
