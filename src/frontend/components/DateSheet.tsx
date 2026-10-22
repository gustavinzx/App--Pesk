import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette, radii } from '../theme/brand';
import { Text } from './Typography';
import { AuthButton } from './AuthUI';

export default function DateSheet({ title, value, minimum, onClose, onConfirm }: { title: string; value: Date; minimum: Date; onClose: () => void; onConfirm: (date: Date) => void }) {
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const [selected, setSelected] = useState(value);
  const min = new Date(minimum.getFullYear(), minimum.getMonth(), minimum.getDate());
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = month.getDay();
  function arrow(icon: 'chevron-left' | 'chevron-right', offset: number, label: string) {
    return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1))} style={s.icon}><Feather name={icon} size={22} color={palette.text} /></Pressable>;
  }
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <View style={s.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar calendário" onPress={onClose} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['bottom']} style={s.sheet} accessibilityViewIsModal>
        <View style={s.handle} />
        <Text style={s.title}>{title}</Text>
        <View style={s.month}>{arrow('chevron-left', -1, 'Mês anterior')}<Text style={s.monthText}>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</Text>{arrow('chevron-right', 1, 'Próximo mês')}</View>
        <View style={s.grid}>{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => <View key={i} style={s.cell}><Text style={s.weekday}>{day}</Text></View>)}</View>
        <View style={s.grid}>
          {Array.from({ length: offset }, (_, i) => <View key={'blank' + i} style={s.cell} />)}
          {Array.from({ length: days }, (_, i) => {
            const date = new Date(month.getFullYear(), month.getMonth(), i + 1);
            const active = date.toDateString() === selected.toDateString();
            const disabled = date < min;
            return <Pressable accessibilityRole="button" accessibilityLabel={date.toLocaleDateString('pt-BR')} accessibilityState={{ selected: active, disabled }} disabled={disabled} key={i} onPress={() => setSelected(date)} style={s.cell}><View style={[s.day, active && { backgroundColor: palette.blue }]}><Text style={{ color: disabled ? palette.border : active ? palette.lime : palette.text }}>{i + 1}</Text></View></Pressable>;
          })}
        </View>
        <AuthButton title="Confirmar data" onPress={() => onConfirm(selected)} />
      </SafeAreaView>
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' },
  sheet: { backgroundColor: palette.background, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, padding: 22, maxWidth: 520, width: '100%', alignSelf: 'center' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: palette.border, marginBottom: 20 },
  title: { color: palette.text, fontSize: 23, fontWeight: '700', marginBottom: 12 },
  month: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  monthText: { fontSize: 14, fontWeight: '600', color: palette.text, textTransform: 'capitalize' },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285714%', height: 44, alignItems: 'center', justifyContent: 'center' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  weekday: { color: palette.muted, fontSize: 11 },
});
