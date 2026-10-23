import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { auth } from '../config/firebase';
import { useSession } from '../context/SessionContext';
import { PeskApiClient } from '../services/PeskApiClient';

export const api = new PeskApiClient();

export function useUsuario() {
  return useSession().user;
}

export function useResource<T>(loader: () => Promise<T>) {
  const user = useUsuario();
  const uid = user?.uid;
  const [result, setResult] = useState<{ uid: string; revision: number; value: T } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);

  useFocusEffect(useCallback(() => {
    if (!uid) return;
    let active = true;
    setLoading(true);
    setError('');
    void loader().then(value => {
      if (active && auth.currentUser?.uid === uid) setResult({ uid, revision: version, value });
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar os dados.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loader, uid, version]));

  return { data: result !== null && result.uid === uid && result.revision === version ? result.value : null, error, loading, refresh };
}

export function useOperation() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const busy = useRef(false);

  async function run(operation: () => Promise<void>, success = '') {
    if (busy.current) return false;
    busy.current = true;
    setPending(true);
    setError('');
    setMessage('');
    try {
      await operation();
      setMessage(success);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.');
      return false;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { pending, error, message, setError, setMessage, run };
}
