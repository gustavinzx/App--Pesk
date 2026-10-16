import dotenv from 'dotenv';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { GerenciarPerfilUsuarioService } from '../../core/business/GerenciarPerfilUsuarioService.js';
import { GerenciarPescariasService } from '../../core/business/GerenciarPescariasService.js';
import { FirebaseTokenVerifier } from '../auth/FirebaseTokenVerifier.js';
import { FirebaseFotoStorage } from '../data/FirebaseFotoStorage.js';
import { gerarCodigoConvite, gerarId } from '../data/GeradoresAleatorios.js';
import { PescariaRepositoryFirestore } from '../data/PescariaRepositoryFirestore.js';
import { UsuarioRepositoryFirestore } from '../data/UsuarioRepositoryFirestore.js';
import { buildServer } from './app.js';

const backendEnvPath = resolve(process.cwd(), 'src/backend/.env');
dotenv.config({
  path: existsSync(backendEnvPath)
    ? backendEnvPath
    : resolve(process.cwd(), '.env'),
});

const firebaseApp =
  getApps()[0] ??
  initializeApp({
    credential: applicationDefault(),
    ...(process.env.FIREBASE_PROJECT_ID
      ? { projectId: process.env.FIREBASE_PROJECT_ID }
      : {}),
    ...(process.env.FIREBASE_STORAGE_BUCKET
      ? { storageBucket: process.env.FIREBASE_STORAGE_BUCKET }
      : {}),
  });

const perfilRepository = new UsuarioRepositoryFirestore(
  getFirestore(firebaseApp)
);
const gerenciarPerfil = new GerenciarPerfilUsuarioService(perfilRepository);
const verificadorToken = new FirebaseTokenVerifier(firebaseApp);
const pescariaRepository = new PescariaRepositoryFirestore(
  getFirestore(firebaseApp)
);
const fotoStorage = new FirebaseFotoStorage(
  firebaseApp,
  process.env.FIREBASE_STORAGE_BUCKET
);
const gerenciarPescarias = new GerenciarPescariasService(
  pescariaRepository,
  fotoStorage,
  gerarId,
  gerarCodigoConvite
);

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const corsOrigins = (process.env.API_CORS_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

async function iniciarServidor() {
  const server = await buildServer(
    { verificadorToken, gerenciarPerfil, gerenciarPescarias },
    { corsOrigins }
  );
  try {
    await server.listen({ port, host });
  } catch (error) {
    server.log.error(error);
    process.exitCode = 1;
  }
}

void iniciarServidor();
