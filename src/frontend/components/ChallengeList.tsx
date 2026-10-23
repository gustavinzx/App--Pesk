import { Text } from './Typography';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';
import { ActionButton, EmptyState, Feedback, Screen, styles, COLORS } from './PeskUI';
import { api, useResource } from '../hooks/usePesk';

const load = () => api.listarDesafios();
const labels = { aberto: 'Em breve', ativo: 'Em andamento', encerrado: 'Concluído', cancelado: 'Cancelado' };

export default function ChallengeList({ completed = false }: { completed?: boolean }) {
  const resource = useResource(load);
  const items = resource.data?.filter(item => completed ? item.status === 'encerrado' : item.status === 'aberto' || item.status === 'ativo') ?? [];
  return <Screen title={completed ? 'Desafios concluídos' : 'Meus grupos'} subtitle={completed ? 'Relembre as pescarias e confira os resultados da turma.' : 'Seus clubes e desafios de pesca, reunidos em um só lugar.'}>
    <Feedback error={resource.error} loading={resource.loading} />
    <ActionButton title="ATUALIZAR" onPress={resource.refresh} secondary disabled={resource.loading} />
    {!completed && <View style={{ marginVertical: 16, gap: 8 }}>
      <ActionButton title="CRIAR GRUPO" onPress={() => router.push('/criar-grupo')} />
      <ActionButton title="ENTRAR POR CONVITE" onPress={() => router.push('/entrar-convite')} secondary />
    </View>}
    {!resource.loading && !resource.error && items.length === 0 && <EmptyState title={completed ? 'Nenhum desafio concluído' : 'Sua próxima pescaria começa aqui'} description={completed ? 'Os resultados aparecerão aqui quando seus desafios forem encerrados.' : 'Crie um grupo ou use o código de um amigo para participar.'} />}
    {items.map(item => <TouchableOpacity accessibilityRole="button" accessibilityLabel={'Abrir ' + item.nome} key={item.id} onPress={() => router.push({ pathname: '/desafio/[id]', params: { id: item.id } })} style={styles.listItem}>
      <Feather name={item.tipo === 'clube' ? 'users' : 'award'} size={24} color={COLORS.accent} />
      <View style={styles.flex}><Text style={styles.itemTitle}>{item.nome}</Text><Text style={styles.mutedText}>{item.tipo === 'clube' ? 'Clube contínuo' : new Date(item.inicio).toLocaleDateString('pt-BR')} · {labels[item.status]}</Text></View>
      <Feather name="chevron-right" size={20} color={COLORS.muted} />
    </TouchableOpacity>)}
  </Screen>;
}
