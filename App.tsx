import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from './src/backend/config/firebase';
import CadastroScreen from './src/frontend/screens/CadastroScreen';
import CompeticoesScreen from './src/frontend/screens/CompeticoesScreen';

export default function App() {
  const [mostrarTestes, setMostrarTestes] = useState(Boolean(auth.currentUser));

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) setMostrarTestes(true);
    });
  }, []);

  if (mostrarTestes) {
    return <CompeticoesScreen onIrCadastro={() => setMostrarTestes(false)} />;
  }

  return <CadastroScreen onAbrirTestes={() => setMostrarTestes(true)} />;
}
