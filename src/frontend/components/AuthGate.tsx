import { type ReactNode } from 'react';
import { Redirect } from 'expo-router';
import { useUsuario } from '../hooks/usePesk';

export default function AuthGate({ children }: { children: ReactNode }) {
  const user = useUsuario();
  return user ? children : <Redirect href="/login" />;
}
