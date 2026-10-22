import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { GerenciarPerfilUsuarioService } from '../../core/business/GerenciarPerfilUsuarioService.js';
import { GerenciarPescariasService } from '../../core/business/GerenciarPescariasService.js';
import { FirebaseTokenVerifier } from '../auth/FirebaseTokenVerifier.js';
import {
  getFirebaseAdminApp,
  getFirebaseAdminFirestore,
} from '../config/firebaseAdmin.js';
import { gerarCodigoConvite, gerarId } from '../data/GeradoresAleatorios.js';
import { LocalFotoStorage } from '../data/LocalFotoStorage.js';
import { PescariaRepositoryFirestore } from '../data/PescariaRepositoryFirestore.js';
import { UsuarioRepositoryFirestore } from '../data/UsuarioRepositoryFirestore.js';
import { buildServer } from './app.js';

const projectRoot = existsSync(resolve(process.cwd(), 'src/backend'))
  ? process.cwd()
  : resolve(process.cwd(), '../..');
const backendDirectory = resolve(projectRoot, 'src/backend');
dotenv.config({ path: resolve(backendDirectory, '.env') });

const firebaseApp = getFirebaseAdminApp();
const firestore = getFirebaseAdminFirestore();

const perfilRepository = new UsuarioRepositoryFirestore(firestore);
const gerenciarPerfil = new GerenciarPerfilUsuarioService(perfilRepository);
const verificadorToken = new FirebaseTokenVerifier(firebaseApp);
const pescariaRepository = new PescariaRepositoryFirestore(firestore);
const apiPublica = (
  process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
).replace(/\/$/, '');
const fotoStorage = new LocalFotoStorage(
  resolve(projectRoot, process.env.LOCAL_PHOTOS_DIR ?? 'local-data/fotos'),
  `${apiPublica}/uploads`
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
    { verificadorToken, gerenciarPerfil, gerenciarPescarias, fotoStorage },
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
