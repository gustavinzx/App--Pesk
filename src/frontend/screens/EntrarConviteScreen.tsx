import { router } from 'expo-router';
import { useState } from 'react';
import { ActionButton, Feedback, Input, Screen } from '../components/PeskUI';
import { api, useOperation } from '../hooks/usePesk';
import { useGroupDirectory } from '../context/GroupDirectoryContext';

export default function EntrarConviteScreen() {
  const [code, setCode] = useState('');
  const operation = useOperation();
  const directory = useGroupDirectory();
  async function join() {
    await operation.run(async () => {
      if (!code.trim()) throw new Error('Informe o código de convite.');
      await api.entrarDesafio(code.trim().toUpperCase());
      directory.refresh();
      router.replace('/');
    });
  }
  return <Screen title="Entrar por convite" subtitle="Recebeu um convite? Digite o código compartilhado pelo organizador para participar da pescaria.">
    <Feedback error={operation.error} loading={operation.pending} />
    <Input label="Código de convite" value={code} onChangeText={setCode} placeholder="Ex.: AB12CD" />
    <ActionButton title={operation.pending ? 'ENTRANDO...' : 'PARTICIPAR DO GRUPO'} onPress={() => void join()} disabled={operation.pending} />
  </Screen>;
}
