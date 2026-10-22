import { usePendingGroupRefresh } from '../hooks/usePendingGroupRefresh';
import { createContext, type ReactNode, useCallback, useContext } from 'react';
import { api, useResource } from '../hooks/usePesk';
import { type DesafioDetalheDto, type RegistroDto } from '../services/PeskApiClient';

type GroupState = { id: string; group: DesafioDetalheDto | null; records: RegistroDto[]; loading: boolean; error: string; refresh: () => void };
const Context = createContext<GroupState | null>(null);
export function GroupProvider({ id, children }: { id: string; children: ReactNode }) {
  const loader = useCallback(() => Promise.all([api.detalheDesafio(id), api.listarRegistros(id)]), [id]);
  const resource = useResource(loader);
  usePendingGroupRefresh(resource.data?.[0].status === 'aberto', resource.refresh);
  return <Context.Provider value={{ id, group: resource.data?.[0] ?? null, records: resource.data?.[1] ?? [], loading: resource.loading, error: resource.error, refresh: resource.refresh }}>{children}</Context.Provider>;
}
export function useGroup() {
  const value = useContext(Context);
  if (!value) throw new Error('A tela precisa estar dentro de GroupProvider.');
  return value;
}
