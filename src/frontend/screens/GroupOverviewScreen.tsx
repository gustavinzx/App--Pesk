import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import GroupCover from '../components/GroupCover';
import { GroupBody, GroupRow, g } from '../components/GroupUI';
import { Feedback } from '../components/PeskUI';
import { Text } from '../components/Typography';
import { useGroup } from '../context/GroupContext';
import { useOperation, useUsuario } from '../hooks/usePesk';
import { palette, radii } from '../theme/brand';
import { useClock } from '../hooks/useClock';

export default function GroupOverviewScreen() {
  const { id, group, records } = useGroup();
  const user = useUsuario();
  const operation = useOperation();
  const now = useClock();
  if (!group) return <GroupBody>{null}</GroupBody>;
  const ranking = group.rankingMaiorPeixe ?? [];
  const leader = ranking.find(item => item.maiorPeixeKg > 0);
  const own = ranking.find(item => item.pescadorId === user?.uid);
  const remaining = group.fim ? Math.max(0, Math.ceil((new Date(group.fim).getTime() - now) / 86400000)) : null;
  const active = group.status === 'ativo';
  const openInfo = () => router.push({ pathname: '/desafio/[id]/info', params: { id } });
  async function invite() {
    await operation.run(async () => {
      await Share.share({ message: 'Entre no grupo ' + group!.nome + ' no Pesk! Código de convite: ' + group!.codigoConvite + '. Abra o app e escolha Entrar por convite.' });
    });
  }
  return <View style={g.safe}>
    <GroupBody>
      <Text style={g.title}>{group.nome}</Text>
      <Text style={[g.muted, { marginBottom: 20 }]}>{group.tipo === 'clube' ? 'Clube de pesca · Sempre juntos' : 'Desafio de pesca · Maior peixe pescado'}</Text>
      <View style={s.hero}>
        <GroupCover theme={group.capaTema} uri={group.capaUrl} flush />
        <View style={s.scores}>
          <View style={s.score}><Feather name="award" color={palette.blue} size={21} /><Text style={s.scoreValue}>{leader ? leader.maiorPeixeKg.toFixed(2) : '0'} kg</Text><Text style={s.scoreLabel}>Líder</Text></View>
          <View style={s.score}><Feather name="user" color={palette.blue} size={21} /><Text style={s.scoreValue}>{own?.maiorPeixeKg ? own.maiorPeixeKg.toFixed(2) : '0'} kg</Text><Text style={s.scoreLabel}>Você</Text></View>
          <View style={s.score}><Feather name={remaining === null ? 'users' : 'calendar'} color={palette.blue} size={21} /><Text style={s.scoreValue}>{remaining === null ? group.participantes.length : remaining}</Text><Text style={s.scoreLabel}>{remaining === null ? 'Pescadores' : 'Dias restantes'}</Text></View>
        </View>
      </View>
      <Feedback error={operation.error} />
      {records.length === 0 && <View style={[g.card, { alignItems: 'center' }]}><Text style={[g.section, { marginBottom: 10, textAlign: 'center' }]}>{group.donoId === user?.uid ? 'Grupo criado!' : 'Sua turma está reunida'}</Text><Text style={[g.muted, { textAlign: 'center' }]}>{active ? 'Convide os amigos e registre a primeira captura para começar a disputa.' : group.status === 'aberto' ? 'Convide sua turma enquanto a pescaria não começa. O maior peixe leva a melhor.' : 'Acompanhe os resultados desta pescaria na aba Ranking.'}</Text></View>}
      <View style={g.card}>
        <GroupRow icon="send" title="Convidar participantes" subtitle="Compartilhe o código com sua turma." onPress={() => void invite()} />
        <Text selectable style={s.code}>{group.codigoConvite}</Text>
        <View style={g.divider} />
        <GroupRow icon="sliders" title="Informações do grupo" subtitle="Participantes, período e regras da pescaria." onPress={openInfo} />
      </View>
      {group.descricao ? <View style={g.card}><Text style={g.section}>Sobre a pescaria</Text><Text style={g.muted}>{group.descricao}</Text></View> : null}
      {records.length > 0 && <View style={g.card}><Text style={g.section}>Últimas capturas</Text>{[...records].filter(item => item.status === 'valido').sort((a, b) => b.dataHora.localeCompare(a.dataHora)).slice(0, 5).map(item => <View key={item.id} style={s.capture}><Feather name="anchor" size={20} color={palette.blue} /><View style={{ flex: 1 }}><Text style={g.rowTitle}>{item.nomeEspecie} · {item.pesoKg.toFixed(2)} kg</Text><Text style={g.muted}>{group.participantes.find(member => member.pescadorId === item.pescadorId)?.nomePescador ?? 'Pescador'} · {item.local}</Text></View></View>)}</View>}
      {!active && <Text style={g.muted}>{group.status === 'aberto' ? 'O registro de capturas será liberado quando o desafio começar com pelo menos dois participantes.' : 'O registro de capturas está encerrado para este grupo.'}</Text>}
      <View style={{ height: 76 }} />
    </GroupBody>
    {active && <Pressable accessibilityRole="button" accessibilityLabel="Registrar captura" onPress={() => router.push({ pathname: '/desafio/[id]/captura', params: { id } })} style={s.fab}><Feather name="plus" size={30} color={palette.lime} /></Pressable>}
  </View>;
}
const s = StyleSheet.create({
  hero: { borderRadius: radii.card, overflow: 'hidden', backgroundColor: palette.surface, marginBottom: 24 },
  scores: { flexDirection: 'row', paddingVertical: 18, paddingHorizontal: 8 },
  score: { flex: 1, alignItems: 'center', gap: 7 },
  scoreValue: { color: palette.text, fontSize: 15, fontWeight: '700' },
  scoreLabel: { color: palette.muted, fontSize: 11 },
  code: { color: palette.blue, fontSize: 16, fontWeight: '700', letterSpacing: 2, marginLeft: 39, marginBottom: 20 },
  capture: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  fab: { position: 'absolute', right: 22, bottom: 20, width: 62, height: 62, borderRadius: 31, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' },
});
