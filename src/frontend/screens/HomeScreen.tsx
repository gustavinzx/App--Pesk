import BrandLogo from '../components/BrandLogo';
import { Text } from '../components/Typography';
import { palette, radii } from '../theme/brand';
import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppMenu } from '../components/AppMenu';
import { auth } from '../../backend/config/firebase';
import { PeskApiClient, type DesafioDto } from '../services/PeskApiClient';

const api = new PeskApiClient();
const accent = palette.blue;
type Icon = React.ComponentProps<typeof Feather>['name'];
const statusLabel = { aberto: 'Em breve', ativo: 'Em andamento', encerrado: 'Concluído', cancelado: 'Cancelado' };

function IconButton({ icon, label, onPress }: { icon: Icon; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.iconButton, pressed && s.pressed]}><Feather name={icon} size={23} color={palette.text} /></Pressable>;
}

export default function HomeScreen() {
  const [user, setUser] = useState(auth.currentUser);
  const openMenu = useAppMenu();
  const [challenges, setChallenges] = useState<DesafioDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [day, setDay] = useState<number | null>(null);

  useEffect(() => onAuthStateChanged(auth, (next) => { setUser(next); setChallenges([]); setError(''); }), []);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const items = await api.listarDesafios();
      if (auth.currentUser?.uid === user.uid) setChallenges(items);
    } catch (err) {
      if (auth.currentUser?.uid === user.uid) setError(err instanceof Error ? err.message : 'Não foi possível carregar seus desafios.');
    } finally { setLoading(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const name = user?.displayName || user?.email?.split('@')[0] || 'Pescador';
  const initial = name.charAt(0).toUpperCase();
  const today = new Date();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = month.getDay();
  const inDay = (item: DesafioDto, value: number) => {
    const start = new Date(month.getFullYear(), month.getMonth(), value);
    const end = new Date(month.getFullYear(), month.getMonth(), value + 1);
    return item.tipo !== 'clube' && new Date(item.inicio) < end && item.fim !== null && new Date(item.fim) >= start && item.status !== 'cancelado';
  };
  const filtered = challenges.filter(item => day !== null && inDay(item, day));
  const open = (section = 'todos', id?: string) => {
    if (id) { router.push({ pathname: '/desafio/[id]', params: { id } }); return; }
    const routes = { criar: '/criar-grupo', entrar: '/entrar-convite', especies: '/especies', todos: '/competicoes' } as const;
    router.push(routes[section as keyof typeof routes] ?? '/competicoes');
  };
  const avatar = (large = false) => user?.photoURL
    ? <Image source={{ uri: user.photoURL }} style={[s.avatar, large && s.avatarLarge]} />
    : <View style={[s.avatar, large && s.avatarLarge]}><Text style={[s.initial, large && { fontSize: 24 }]}>{initial}</Text></View>;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <IconButton icon="menu" label="Abrir menu" onPress={openMenu} />
        <BrandLogo width={112} />
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir perfil e menu" onPress={openMenu} style={s.iconButton}>{avatar()}</Pressable>
      </View>
      <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={accent} colors={[accent]} />} showsVerticalScrollIndicator={false}>
        <Text style={s.eyebrow}>SEU PONTO DE ENCONTRO</Text>
        <Text style={s.title}>Bora pescar{user ? ', ' + name.split(' ')[0] : ''}?</Text>
        <Text style={s.subtitle}>Boas histórias começam na próxima pescaria.</Text>
        <View style={s.actions}>
          <Pressable accessibilityRole="button" onPress={() => open('criar')} style={({ pressed }) => [s.primary, pressed && s.pressed]}><Feather name="plus" size={19} color={palette.lime} /><Text style={s.primaryLabel}>Criar grupo</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => open('entrar')} style={({ pressed }) => [s.secondary, pressed && s.pressed]}><Feather name="users" size={19} color={palette.text} /><Text style={s.secondaryLabel}>Entrar por convite</Text></Pressable>
        </View>

        <View style={s.calendar}>
          <View style={s.between}>
            <Text style={s.month}>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</Text>
            <View style={s.horizontal}>
              <IconButton icon="chevron-left" label="Mês anterior" onPress={() => { setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); setDay(null); }} />
              <IconButton icon="chevron-right" label="Próximo mês" onPress={() => { setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); setDay(null); }} />
            </View>
          </View>
          <View style={s.grid}>{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((value, index) => <View key={index} style={s.cell}><Text style={s.weekday}>{value}</Text></View>)}</View>
          <View style={s.grid}>
            {Array.from({ length: offset }, (_, i) => <View key={'blank' + i} style={s.cell} />)}
            {Array.from({ length: days }, (_, i) => {
              const value = i + 1;
              const isToday = value === today.getDate() && month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();
              const selected = day === value;
              const event = challenges.some(item => inDay(item, value));
              return <Pressable key={value} accessibilityRole="button" accessibilityLabel={new Date(month.getFullYear(), month.getMonth(), value).toLocaleDateString('pt-BR') + (event ? ', com desafio' : '')} accessibilityState={{ selected }} onPress={() => setDay(selected ? null : value)} style={s.cell}>
                <View style={[s.day, isToday && s.today, selected && s.selected]}><Text style={[s.dayLabel, isToday && { color: accent }, selected && { color: palette.lime, fontWeight: '800' }]}>{value}</Text>{event && <View style={[s.dot, selected && { backgroundColor: palette.lime }]} />}</View>
              </Pressable>;
            })}
          </View>
          <View style={s.calendarFooter}><View style={s.legendDot} /><Text style={s.small}>Dias com desafios</Text>{day !== null && <Pressable accessibilityRole="button" onPress={() => setDay(null)} style={s.clearFilter}><Text style={s.link}>Limpar filtro</Text></Pressable>}</View>
        </View>

        {error ? <View style={s.empty}><Feather name="wifi-off" size={28} color={palette.muted} /><Text style={s.emptyTitle}>Não conseguimos carregar a agenda</Text><Text style={s.subtitle}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={s.secondary}><Text style={s.secondaryLabel}>Tentar novamente</Text></Pressable></View>
        : day !== null ? <>
          <View style={s.between}><Text style={s.section}>Agenda do dia {day}</Text><Text style={s.small}>{filtered.length} pescarias</Text></View>
          {loading ? <ActivityIndicator color={accent} style={{ margin: 24 }} /> : filtered.length === 0 ? <View style={s.empty}><Feather name="calendar" size={28} color={accent} /><Text style={s.emptyTitle}>Dia livre para uma pescaria</Text><Text style={s.emptyText}>Nenhum desafio agendado para este dia.</Text></View> : filtered.map(item => <Pressable accessibilityRole="button" accessibilityLabel={'Abrir grupo ' + item.nome} key={item.id} onPress={() => open('todos', item.id)} style={s.challenge}><Feather name="award" size={25} color={accent} /><View style={{ flex: 1 }}><Text style={s.challengeTitle}>{item.nome}</Text><Text style={s.small}>{statusLabel[item.status]}</Text></View><Feather name="chevron-right" size={20} color={palette.muted} /></Pressable>)}
        </> : <View style={s.empty}>
          <View style={s.emptyIcon}><Feather name="users" size={29} color={accent} /></View>
          <Text style={s.emptyTitle}>Sua turma está no menu</Text>
          <Text style={s.emptyText}>Seus grupos ficam no menu lateral. Abra uma pescaria para ver os detalhes, acompanhar o ranking e conversar com a turma.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Ver grupos no menu" onPress={openMenu} style={s.clearFilter}><Text style={s.link}>Abrir menu →</Text></Pressable>
        </View>}
        <Text style={s.footer}>PESK · A pescaria fica melhor em grupo.</Text>
      </ScrollView>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 25, fontWeight: '900', color: palette.text, letterSpacing: 3 },
  avatar: { width: 34, height: 34, borderRadius: radii.card, backgroundColor: palette.softBlue, alignItems: 'center', justifyContent: 'center' },
  avatarLarge: { width: 58, height: 58, borderRadius: 29 },
  initial: { color: accent, fontWeight: '700', fontSize: 16 },
  content: { padding: 22, paddingBottom: 36, maxWidth: 680, width: '100%', alignSelf: 'center' },
  eyebrow: { color: accent, fontSize: 10, letterSpacing: 2, fontWeight: '700', marginTop: 16, marginBottom: 10 },
  title: { color: palette.text, fontSize: 29, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { color: palette.muted, fontSize: 13, lineHeight: 21, marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24, marginBottom: 28 },
  primary: { minHeight: 48, borderRadius: radii.input, backgroundColor: accent, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryLabel: { color: palette.lime, fontSize: 13, fontWeight: '700' },
  secondary: { minHeight: 48, borderRadius: radii.input, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryLabel: { color: palette.text, fontSize: 13, fontWeight: '600' },
  calendar: { backgroundColor: palette.surface, borderRadius: radii.card, padding: 14, marginBottom: 30 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  horizontal: { flexDirection: 'row' },
  month: { color: palette.text, fontSize: 15, fontWeight: '600', textTransform: 'capitalize', flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285714%', height: 44, alignItems: 'center', justifyContent: 'center' },
  weekday: { color: palette.muted, fontSize: 11, fontWeight: '600' },
  day: { width: 35, height: 37, alignItems: 'center', justifyContent: 'center', borderRadius: radii.input },
  dayLabel: { color: palette.text, fontSize: 14 },
  today: { borderWidth: 1, borderColor: palette.softBlue },
  selected: { backgroundColor: accent, borderWidth: 0 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: accent, position: 'absolute', bottom: 3 },
  calendarFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderColor: palette.border, marginTop: 10, paddingTop: 12, minHeight: 45 },
  legendDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: accent },
  small: { fontSize: 11, color: palette.muted, lineHeight: 18 },
  link: { color: accent, fontSize: 12, fontWeight: '600' },
  clearFilter: { padding: 12, minHeight: 44, justifyContent: 'center' },
  section: { color: palette.text, fontSize: 20, fontWeight: '600', letterSpacing: -0.4 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 18 },
  tab: { paddingHorizontal: 17, minHeight: 44, justifyContent: 'center', borderRadius: radii.card, backgroundColor: palette.surface },
  activeTab: { backgroundColor: palette.softBlue },
  tabLabel: { color: palette.muted, fontSize: 12, fontWeight: '500' },
  activeTabLabel: { color: accent },
  empty: { borderWidth: 1, borderColor: palette.border, borderStyle: 'dashed', borderRadius: radii.card, paddingHorizontal: 22, paddingVertical: 28, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: palette.softBlue, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyTitle: { color: palette.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  emptyText: { color: palette.muted, fontSize: 13, lineHeight: 21, textAlign: 'center', maxWidth: 290 },
  challenge: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: palette.surface, borderRadius: radii.card, padding: 18, marginBottom: 10 },
  challengeIcon: { width: 46, height: 46, borderRadius: radii.input, backgroundColor: palette.softBlue, alignItems: 'center', justifyContent: 'center' },
  challengeTitle: { color: palette.text, fontSize: 15, fontWeight: '600', marginBottom: 5 },
  footer: { color: palette.muted, fontSize: 10, textAlign: 'center', marginTop: 36, letterSpacing: 0.4 },
  modal: { flex: 1, backgroundColor: '#0008', flexDirection: 'row' },
  drawer: { width: '87%', maxWidth: 390, backgroundColor: palette.background, height: '100%' },
  drawerContent: { paddingHorizontal: 22, paddingBottom: 30 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 26 },
  profileName: { color: palette.text, fontSize: 21, fontWeight: '700', marginBottom: 5 },
  profileEmail: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  menuGroup: { borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 17 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 20, minHeight: 57, paddingVertical: 12, paddingHorizontal: 3, borderRadius: radii.input },
  menuLabel: { color: palette.text, fontSize: 17, flexShrink: 1 },
  drawerFooter: { color: palette.muted, letterSpacing: 2, fontSize: 10, marginTop: 32, paddingHorizontal: 3 },
  pressed: { opacity: 0.6 },
  infoOverlay: { flex: 1, backgroundColor: '#000B', justifyContent: 'center', padding: 24 },
  infoCard: { backgroundColor: palette.surface, borderRadius: radii.card, padding: 22, maxWidth: 480, width: '100%', alignSelf: 'center' },
  infoText: { color: palette.text, fontSize: 14, lineHeight: 23, marginTop: 16 },
});

