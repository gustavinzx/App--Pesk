import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, useUsuario } from '../hooks/usePesk';
import { type DesafioDto } from '../services/PeskApiClient';

type Directory = { groups: DesafioDto[]; loading: boolean; error: string; refresh: () => void; upsert: (group: DesafioDto) => void; remove: (id: string) => void };
const Context = createContext<Directory | null>(null);
export function GroupDirectoryProvider({ children }: { children: ReactNode }) {
  const user = useUsuario();
  const uid = user?.uid;
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ uid: string; revision: number; groups: DesafioDto[]; error: string } | null>(null);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!uid) return;
    let active = true;
    void api.listarDesafios().then(groups => {
      if (active) setResult({ uid, revision, groups, error: '' });
    }).catch(error => {
      if (active) setResult(previous => ({ uid, revision, groups: previous?.uid === uid ? previous.groups : [], error: error instanceof Error ? error.message : 'Não foi possível carregar seus grupos.' }));
    });
    return () => { active = false; };
  }, [uid, revision]);
  const groups = result?.uid === uid ? result?.groups ?? [] : [];
  return <Context.Provider value={{
    groups, loading: Boolean(uid) && (result?.uid !== uid || result?.revision !== revision),
    error: result?.uid === uid ? result?.error ?? '' : '', refresh,
    upsert(group) {
      if (!uid) return;
      setResult(previous => ({ uid, revision, groups: [group, ...(previous?.uid === uid ? previous.groups.filter(item => item.id !== group.id) : [])], error: '' }));
      refresh();
    },
    remove(id) {
      if (!uid) return;
      setResult(previous => ({ uid, revision, groups: previous?.uid === uid ? previous.groups.filter(item => item.id !== id) : [], error: '' }));
      refresh();
    },
  }}>{children}</Context.Provider>;
}
export function useGroupDirectory() {
  const value = useContext(Context);
  if (!value) throw new Error('O diretório de grupos precisa de GroupDirectoryProvider.');
  return value;
}
