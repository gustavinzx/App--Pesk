import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { type MensagemGrupoDto } from '../services/PeskApiClient';
import { api } from './usePesk';

export function mergeMessages(previous: MensagemGrupoDto[], incoming: MensagemGrupoDto[]) {
  const items = new Map(previous.map(item => [item.id, item]));
  incoming.forEach(item => items.set(item.id, item));
  return [...items.values()].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id));
}
export function useGroupChat(id: string) {
  const [messages, setMessages] = useState<MensagemGrupoDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [olderLoading, setOlderLoading] = useState(false);
  const [error, setError] = useState('');
  const initialized = useRef(false);
  const fetchLatest = useRef<() => void>(() => {});
  const activeRef = useRef(false);
  const historyBusy = useRef(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    let busy = false;
    activeRef.current = true;
    async function load() {
      if (busy || (AppState.currentState && AppState.currentState !== 'active')) return;
      busy = true;
      try {
        const page = await api.listarMensagens(id);
        if (active) {
          setMessages(previous => mergeMessages(previous, page.mensagens));
          if (!initialized.current) { setCursor(page.proximoCursor); initialized.current = true; }
          setError('');
        }
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar as mensagens.'); }
      finally { if (active) setLoading(false); busy = false; }
    }
    fetchLatest.current = () => { void load(); };
    void load();
    const interval = setInterval(() => { void load(); }, 5000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { active = false; activeRef.current = false; clearInterval(interval); subscription.remove(); };
  }, [id]));
  async function loadOlder() {
    if (!cursor || historyBusy.current) return;
    historyBusy.current = true;
    setOlderLoading(true);
    try {
      const page = await api.listarMensagens(id, cursor);
      if (activeRef.current) { setMessages(previous => mergeMessages(previous, page.mensagens)); setCursor(page.proximoCursor); setError(''); }
    } catch (err) { if (activeRef.current) setError(err instanceof Error ? err.message : 'Não foi possível carregar o histórico.'); }
    finally { historyBusy.current = false; if (activeRef.current) setOlderLoading(false); }
  }
  return { messages, loading, olderLoading, error, cursor, loadOlder, refresh: () => fetchLatest.current(), append: (message: MensagemGrupoDto) => setMessages(previous => mergeMessages(previous, [message])) };
}
