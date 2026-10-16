import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Indica se as variáveis essenciais de configuração do Firebase estão preenchidas.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId &&
  !firebaseConfig.apiKey.includes('coloque_sua_api_key')
);

if (!isFirebaseConfigured) {
  console.warn(
    '[Pesk Firebase] Variáveis de ambiente não configuradas ou com valores de exemplo. ' +
    'Crie ou edite o arquivo .env com as credenciais do seu projeto Firebase Console.'
  );
}

// Inicializa a aplicação Firebase (ou usa dummy seguro caso o .env ainda não tenha sido preenchido)
function getOrCreateApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(
    isFirebaseConfigured
      ? firebaseConfig
      : {
          apiKey: 'AIzaNotConfiguredPlaceholderKey',
          authDomain: 'pesk-placeholder.firebaseapp.com',
          projectId: 'pesk-placeholder',
          storageBucket: 'pesk-placeholder.appspot.com',
          messagingSenderId: '000000000000',
          appId: '1:000000000000:web:peskplaceholder',
        }
  );
}

const app = getOrCreateApp();

function createAuth(): Auth {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Em caso de re-execução ou Hot Reload no Expo
    return getAuth(app);
  }
}

export const auth: Auth = createAuth();
export const db: Firestore = getFirestore(app);
export { firebaseConfig };
