import { onAuthStateChanged, type User } from 'firebase/auth';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { auth } from '../../backend/config/firebase';

const SessionContext = createContext<{
  user: User | null; loading: boolean; setRegistering: (value: boolean) => void;
} | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  useEffect(() => onAuthStateChanged(auth, next => { setUser(next); setLoading(false); }), []);
  return <SessionContext.Provider value={{ user: registering ? null : user, loading, setRegistering }}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('A sessão precisa estar dentro de SessionProvider.');
  return session;
}
