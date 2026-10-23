import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type ReactNode } from 'react';
import { useGroup } from '../context/GroupContext';
import { palette, radii } from '../theme/brand';
import { useAppMenu } from './AppMenu';
import { AuthButton } from './AuthUI';
import { Feedback } from './PeskUI';
import { Text } from './Typography';

export function GroupHeader({ title }: { title?: string }) {
  const { id, group } = useGroup();
  const openMenu = useAppMenu();
  return <SafeAreaView edges={['top']} style={{ backgroundColor: palette.background }}><View style={g.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu" onPress={openMenu} style={g.icon}><Feather name="menu" size={24} color={palette.text} /></Pressable>
    <Text numberOfLines={1} style={g.headerTitle}>{title ?? group?.nome ?? 'Grupo'}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Informações do grupo" onPress={() => router.push({ pathname: '/desafio/[id]/info', params: { id } })} style={g.icon}><Feather name="more-horizontal" size={26} color={palette.text} /></Pressable>
  </View></SafeAreaView>;
}
export function GroupBody({ children }: { children: ReactNode }) {
  const { loading, error, refresh } = useGroup();
  return <ScrollView style={g.safe} contentContainerStyle={g.content} showsVerticalScrollIndicator={false}>
    <Feedback loading={loading} error={error} />
    {error ? <AuthButton title="Tentar novamente" onPress={refresh} secondary /> : children}
  </ScrollView>;
}
export function InitialAvatar({ name, uri, size = 44 }: { name: string; uri?: string; size?: number }) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  return uri ? <Image source={{ uri }} style={style} /> : <View style={[style, { backgroundColor: palette.softBlue, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: palette.blue, fontWeight: '700', fontSize: size * 0.37 }}>{name.trim().charAt(0).toUpperCase() || 'P'}</Text></View>;
}
export function GroupRow({ icon, title, subtitle, onPress }: { icon: React.ComponentProps<typeof Feather>['name']; title: string; subtitle?: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={g.actionRow}><Feather name={icon} size={24} color={palette.blue} /><View style={{ flex: 1 }}><Text style={g.rowTitle}>{title}</Text>{subtitle && <Text style={g.muted}>{subtitle}</Text>}</View><Feather name="chevron-right" size={20} color={palette.muted} /></Pressable>;
}
export function ConfirmDialog({ visible, title, description, busy, onClose, onConfirm }: { visible: boolean; title: string; description: string; busy?: boolean; onClose: () => void; onConfirm: () => void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}><View style={g.overlay}><View style={g.dialog} accessibilityViewIsModal><Text style={g.section}>{title}</Text><Text style={g.muted}>{description}</Text><AuthButton title="Confirmar" onPress={onConfirm} busy={busy} /><AuthButton title="Voltar" onPress={onClose} disabled={busy} secondary /></View></View></Modal>;
}
export function periodLabel(group: { tipo?: string; inicio: string; fim: string | null }) {
  const format = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return group.tipo === 'clube' ? 'Clube contínuo · Sem data final' : format(group.inicio) + ' — ' + (group.fim ? format(group.fim) : 'Sem data final');
}
export const g = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 62, gap: 10 },
  headerTitle: { flex: 1, color: palette.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 30, width: '100%', maxWidth: 680, alignSelf: 'center', flexGrow: 1 },
  title: { color: palette.text, fontSize: 30, fontWeight: '700', letterSpacing: -1, marginBottom: 10 },
  section: { color: palette.text, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  muted: { color: palette.muted, fontSize: 12, lineHeight: 20 },
  card: { backgroundColor: palette.surface, borderRadius: radii.card, padding: 20, marginBottom: 20 },
  rowTitle: { color: palette.text, fontSize: 15, fontWeight: '600', marginBottom: 3 },
  actionRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 17 },
  divider: { height: 1, backgroundColor: palette.border },
  overlay: { flex: 1, backgroundColor: '#0007', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: palette.background, borderRadius: radii.sheet, padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center', gap: 12 },
});
