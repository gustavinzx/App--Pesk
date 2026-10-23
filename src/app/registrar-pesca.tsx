import { usePendingGroupRefresh } from '../frontend/hooks/usePendingGroupRefresh';
import { periodLabel } from '../frontend/components/GroupUI';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import AuthGate from '../frontend/components/AuthGate';
import { ActionButton, Feedback, Screen, styles } from '../frontend/components/PeskUI';
import { Text } from '../frontend/components/Typography';
import { api, useResource } from '../frontend/hooks/usePesk';
const load = () => api.listarDesafios();
function Register() {
  const { returnTo = '/' } = useLocalSearchParams<{ returnTo?: string }>();
  const resource = useResource(load);
  const groups = resource.data ?? [];
  usePendingGroupRefresh(groups.some(group => group.status === 'aberto'), resource.refresh);
  return <Screen title="Registrar pesca" subtitle="Escolha o grupo em que sua captura vai contar pontos.">
    <Feedback loading={resource.loading} error={resource.error} />
    {groups.map(group => <View key={group.id} style={styles.card}><Text style={styles.cardTitle}>{group.nome}</Text><Text style={styles.hint}>{periodLabel(group)}</Text><Text style={styles.bodyText}>{group.status === 'ativo' ? 'Disponível para registrar sua pesca.' : group.status === 'aberto' ? 'Aguardando início e pelo menos dois participantes.' : 'Grupo encerrado.'}</Text><ActionButton title="REGISTRAR NESTE GRUPO" disabled={group.status !== 'ativo'} onPress={() => router.push({ pathname: '/desafio/[id]/captura', params: { id: group.id, returnTo } })} /></View>)}
    {!resource.loading && !resource.error && groups.length === 0 && <Text style={styles.bodyText}>Você precisa criar um grupo ou entrar por convite para pontuar suas capturas.</Text>}
    <ActionButton title="ATUALIZAR GRUPOS" secondary onPress={resource.refresh} />
    <ActionButton title="CRIAR GRUPO" secondary onPress={() => router.push('/criar-grupo')} />
  </Screen>;
}
export default function Route() { return <AuthGate><Register /></AuthGate>; }
