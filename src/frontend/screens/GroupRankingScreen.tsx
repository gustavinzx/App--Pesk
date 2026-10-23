import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { GroupBody, InitialAvatar, g, periodLabel } from '../components/GroupUI';
import { Text } from '../components/Typography';
import { useGroup } from '../context/GroupContext';
import { useUsuario } from '../hooks/usePesk';
import { palette, radii } from '../theme/brand';
import { useClock } from '../hooks/useClock';

export default function GroupRankingScreen() {
  const { id, group, records } = useGroup();
  const user = useUsuario();
  const now = useClock();
  if (!group) return <GroupBody>{null}</GroupBody>;
  const ranking = group.rankingMaiorPeixe ?? [];
  const valid = records.filter(item => item.status === 'valido');
  const days = new Set(valid.map(item => new Date(item.dataHora).toLocaleDateString('pt-BR'))).size;
  const start = new Date(group.inicio).getTime();
  const end = group.fim ? new Date(group.fim).getTime() : null;
  const elapsed = Math.max(1, Math.floor((Math.min(now, end ?? now) - start) / 86400000) + 1);
  const progress = end ? Math.max(0, Math.min(1, (now - start) / (end - start))) : 1;
  return <GroupBody>
    <Text style={g.title}>{group.nome}</Text>
    <Text style={[g.muted, { marginBottom: 18 }]}>{periodLabel(group)}</Text>
    {end !== null && <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={s.progress}><View style={[s.progressFill, { width: (progress * 100) + '%' as `${number}%` }]} /></View>}
    <Pressable accessibilityRole="button" accessibilityLabel="Ver convite do grupo" onPress={() => router.push({ pathname: '/desafio/[id]/info', params: { id } })} style={s.invite}><Feather name="share-2" size={20} color={palette.blue} /><Text style={s.code}>{group.codigoConvite}</Text></Pressable>
    <Text style={g.section}>Classificação</Text>
    <Text style={[g.muted, { marginBottom: 14 }]}>Maior peixe pescado · Peso em kg</Text>
    <View style={g.card}>
      {ranking.map((item, index) => <View key={item.pescadorId} style={[s.rank, index > 0 && { borderTopWidth: 1, borderColor: palette.border }]}>
        <InitialAvatar name={item.nomePescador} uri={item.pescadorId === user?.uid ? user.photoURL ?? undefined : undefined} />
        <View style={{ flex: 1 }}><Text style={g.rowTitle}>{item.nomePescador}{item.pescadorId === user?.uid ? ' · Você' : ''}</Text><Text style={g.muted}>{item.maiorPeixeKg > 0 ? item.maiorPeixeKg.toFixed(2) + ' kg' : 'Sem capturas'}</Text></View>
        <Text style={[s.position, index === 0 && item.maiorPeixeKg > 0 && { color: palette.blue }]}>{item.maiorPeixeKg > 0 ? (index + 1) + 'º' : '—'}</Text>
      </View>)}
      {ranking.length === 0 && <Text style={g.muted}>A classificação aparecerá com as primeiras capturas.</Text>}
    </View>
    <Text style={g.section}>Estatísticas do grupo</Text>
    <View style={g.card}>
      {[['activity', String(valid.length), 'Capturas válidas'], ['calendar', String(days), 'Dias com pescaria'], ['trending-up', (valid.length / elapsed).toFixed(1), 'Capturas por dia'], ['award', group.melhorPeixe ? group.melhorPeixe.pesoKg.toFixed(2) + ' kg' : '0 kg', 'Maior peixe do grupo']].map(([icon, value, label]) => <View key={label} style={s.stat}><Feather name={icon as React.ComponentProps<typeof Feather>['name']} size={25} color={palette.blue} /><View><Text style={s.statValue}>{value}</Text><Text style={g.muted}>{label}</Text></View></View>)}
    </View>
  </GroupBody>;
}
const s = StyleSheet.create({
  progress: { height: 12, backgroundColor: palette.softBlue, borderRadius: radii.pill, overflow: 'hidden', marginBottom: 18 },
  progressFill: { height: '100%', backgroundColor: palette.blue, borderRadius: radii.pill },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, marginBottom: 26 },
  code: { color: palette.blue, fontWeight: '700', letterSpacing: 2 },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 },
  position: { color: palette.muted, fontWeight: '700', fontSize: 21 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 18, marginVertical: 13 },
  statValue: { color: palette.text, fontSize: 21, fontWeight: '700', marginBottom: 4 },
});
