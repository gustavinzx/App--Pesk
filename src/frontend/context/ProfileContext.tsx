import { useCallback, createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSession } from './SessionContext';
import { api } from '../hooks/usePesk';
import type { PerfilDto } from '../services/PeskApiClient';
const Context = createContext<{ profile: PerfilDto | null; update: (value: PerfilDto) => void; error: string; refresh: () => Promise<void> }>({ profile: null, update: () => {}, error: '', refresh: async () => {} });
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [profile, setProfile] = useState<PerfilDto | null>(null);
  const [error, setError] = useState('');
  const update = useCallback((value: PerfilDto) => { setProfile(value); setError(''); }, []);
  const refresh = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) return;
    try { const value = await api.perfil(); if (value.id === uid) update(value); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível carregar o perfil.'); }
  }, [user?.uid, update]);
  useEffect(() => {
    let active = true;
    if (user) void api.perfil().then(value => { if (active) { update(value); setError(''); } }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [user?.uid, user, update]);
  return <Context.Provider value={{ profile: profile?.id === user?.uid ? profile : null, update, error, refresh }}>{children}</Context.Provider>;
}
export function useProfile() { return useContext(Context); }
