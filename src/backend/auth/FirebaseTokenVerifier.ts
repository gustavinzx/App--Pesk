import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import { getAuth } from 'firebase-admin/auth';
import type { VerificadorToken } from '../../core/business/ports/VerificadorToken.js';

export class FirebaseTokenVerifier implements VerificadorToken {
  private readonly auth: Auth;

  constructor(app: App) {
    this.auth = getAuth(app);
  }

  async verificar(token: string) {
    const decoded = await this.auth.verifyIdToken(token);
    if (!decoded.email) {
      throw new Error('O token Firebase não contém um e-mail.');
    }
    return {
      uid: decoded.uid,
      email: decoded.email,
      ...(typeof decoded.name === 'string' ? { nome: decoded.name } : {}),
    };
  }
}
