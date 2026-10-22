import {
  applicationDefault,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/** Inicializa uma única instância do Firebase Admin para uso exclusivo no servidor. */
export function getFirebaseAdminApp(): App {
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error(
      'FIREBASE_PROJECT_ID não foi definido no ambiente do backend.'
    );
  }
  const existingApp = getApps().find((app) => app.name === '[DEFAULT]');
  if (existingApp) return existingApp;

  return initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

export function getFirebaseAdminFirestore() {
  return getFirestore(getFirebaseAdminApp());
}
