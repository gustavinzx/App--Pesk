import BrandLogo from '../components/BrandLogo';
import { Text } from '../components/Typography';
import { palette, radii } from '../theme/brand';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppMenu } from '../components/AppMenu';
import { useProfile } from '../context/ProfileContext';
import { api, useResource, useUsuario } from '../hooks/usePesk';
import { Feedback } from '../components/PeskUI';
const load = async () => {
  const groups = await api.listarDesafios();
  return (await Promise.all(groups.map(group => api.listarRegistros(group.id)))).flat();
};
export default function HomeScreen() {
  const user = useUsuario();
  const { profile } = useProfile();
  const openMenu = useAppMenu();
  const resource = useResource(load);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [day, setDay] = useState<number | null>(null);
  const records = (resource.data ?? []).filter(item => item.pescadorId === user?.uid && item.status === 'valido');
  const name = profile?.nome || user?.displayName || user?.email?.split('@')[0] || 'Pescador';
  const photo = profile?.fotoUrl || user?.photoURL;
  const daysActive = new Set(records.map(item => new Date(item.dataHora).toLocaleDateString('pt-BR'))).size;
  const best = Math.max(0, ...records.map(item => item.pesoKg));
  const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = month.getDay();
  const today = new Date();
  const inDay = (date: string, value: number) => {
    const when = new Date(date);
    return when.getFullYear() === month.getFullYear() && when.getMonth() === month.getMonth() && when.getDate() === value;
  };
  const selected = records.filter(item => day !== null && inDay(item.dataHora, day));
  const stats = [[String(records.length), 'Capturas'], [String(daysActive), 'Dias de pesca'], [best.toFixed(2) + ' kg', 'Maior peixe']];
  function changeMonth(step: number) { setMonth(new Date(month.getFullYear(), month.getMonth() + step, 1)); setDay(null); }
  return <SafeAreaView style={s.safe}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu" onPress={openMenu} style={s.icon}><Feather name="menu" size={25} color={palette.text} /></Pressable>
      <BrandLogo width={96} />
      <Pressable accessibilityRole="button" accessibilityLabel="Configurações do perfil" onPress={() => router.push('/perfil')} style={s.icon}><Feather name="settings" size={25} color={palette.text} /></Pressable>
    </View>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={resource.loading} onRefresh={resource.refresh} />}>
      <View style={s.profile}>{photo ? <Image source={{ uri: photo }} accessibilityLabel="Sua foto de perfil" style={s.avatar} /> : <View style={[s.avatar, s.placeholder]}><Text style={s.initial}>{name.charAt(0).toUpperCase()}</Text></View>}
        <Text style={s.title}>Bora pescar, {name.split(' ')[0]}?</Text>
        <Text style={s.subtitle}>Boas histórias começam na próxima pescaria.</Text>
        {profile?.descricao ? <Text style={s.bio}>{profile.descricao}</Text> : null}
      </View>
      <View style={s.stats}>{stats.map(([value, label]) => <View key={label} style={s.stat}><Text style={s.value}>{resource.error || resource.loading ? '—' : value}</Text><Text style={s.label}>{label}</Text></View>)}</View>
      <Feedback error={resource.error} />
      {resource.error ? <Pressable accessibilityRole="button" onPress={resource.refresh} style={s.linkButton}><Text style={s.link}>Tentar novamente</Text></Pressable> : null}
      <View style={s.calendar}>
        <View style={s.monthRow}><Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => changeMonth(-1)} style={s.icon}><Feather name="chevron-left" size={22} color={palette.text} /></Pressable><Text style={s.month}>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</Text><Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => changeMonth(1)} style={s.icon}><Feather name="chevron-right" size={22} color={palette.text} /></Pressable></View>
        <View style={s.grid}>{['D','S','T','Q','Q','S','S'].map((label,index) => <View key={index} style={s.cell}><Text style={s.label}>{label}</Text></View>)}</View>
        <View style={s.grid}>
          {Array.from({ length: offset }, (_,index) => <View key={'blank'+index} style={s.cell} />)}
          {Array.from({ length: totalDays }, (_,index) => {
            const value = index+1;
            const active = records.some(item => inDay(item.dataHora, value));
            const isToday = value === today.getDate() && month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();
            return <Pressable key={value} accessibilityRole="button" accessibilityLabel={new Date(month.getFullYear(), month.getMonth(),value).toLocaleDateString('pt-BR') + (active ? ', com captura' : '')} accessibilityState={{ selected: day === value }} onPress={() => setDay(day === value ? null : value)} style={s.cell}><View style={[s.day, isToday && s.today, day === value && s.selected]}><Text style={[s.dayText, day === value && { color: palette.lime }]}>{value}</Text>{active && <View style={[s.dot, day === value && { backgroundColor: palette.lime }]} />}</View></Pressable>;
          })}
        </View>
        <Text style={s.legend}>● Dias com capturas</Text>
      </View>
      {day !== null && <View style={s.catches}><Text style={s.section}>Pescarias do dia {day}</Text>{selected.length ? selected.map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/desafio/[id]', params: { id: item.desafioId } })} style={s.catch}><Image source={{ uri: item.fotoUrl }} style={s.catchPhoto} /><View style={{ flex: 1 }}><Text style={s.catchName}>{item.nomeEspecie} · {item.pesoKg.toFixed(2)} kg</Text><Text style={s.label}>{item.local}</Text></View></Pressable>) : <Text style={s.subtitle}>Nenhuma captura registrada neste dia.</Text>}</View>}
      <Pressable accessibilityRole="button" onPress={() => router.push('/especies')} style={s.linkButton}><Text style={s.link}>Ver meu Samburá</Text></Pressable>
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel="Registrar pesca" onPress={() => router.push({ pathname: '/registrar-pesca', params: { returnTo: '/' } })} style={s.fab}><Feather name="plus" size={32} color={palette.lime} /></Pressable>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingBottom: 110 },
  profile: { alignItems: 'center', paddingTop: 12 },
  avatar: { width: 104, height: 104, borderRadius: 52, marginBottom: 20 },
  placeholder: { backgroundColor: palette.softBlue, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 42, fontWeight: '700', color: palette.blue },
  title: { fontSize: 26, fontWeight: '700', color: palette.text, textAlign: 'center' },
  subtitle: { fontSize: 13, lineHeight: 21, color: palette.muted, textAlign: 'center', marginTop: 8 },
  bio: { fontSize: 13, lineHeight: 21, color: palette.text, textAlign: 'center', marginTop: 12 },
  stats: { flexDirection: 'row', paddingVertical: 28 },
  stat: { flex: 1, alignItems: 'center', gap: 6 },
  value: { fontSize: 20, fontWeight: '700', color: palette.text },
  label: { fontSize: 11, color: palette.muted, lineHeight: 18 },
  calendar: { borderRadius: radii.card, backgroundColor: palette.surface, padding: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  month: { flex: 1, fontSize: 16, fontWeight: '700', textAlign: 'center', color: palette.text, textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285714%', height: 44, alignItems: 'center', justifyContent: 'center' },
  day: { width: 34, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayText: { color: palette.text, fontSize: 13 },
  today: { borderWidth: 1, borderColor: palette.blue },
  selected: { backgroundColor: palette.blue },
  dot: { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: palette.blue },
  legend: { color: palette.muted, fontSize: 10, marginTop: 12, marginBottom: 4, textAlign: 'center' },
  linkButton: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: radii.pill, backgroundColor: palette.softBlue, marginTop: 20 },
  link: { fontSize: 12, color: palette.blue, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 24, right: 22, width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.blue, elevation: 4, boxShadow: '0 4px 12px #274EEB30' },
  catches: { marginTop: 24 },
  section: { fontSize: 18, fontWeight: '700', color: palette.text, marginBottom: 12 },
  catch: { padding: 12, borderRadius: radii.input, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  catchPhoto: { width: 48, height: 48, borderRadius: 16 },
  catchName: { fontSize: 13, color: palette.text, fontWeight: '600' },
});
