import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { CATALOGO_ESPECIES } from '../../core/domain/catalogoEspecies';
import { Text } from './Typography';
import { styles } from './PeskUI';
import { g } from './GroupUI';
export default function SpeciesSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Selecionar espécie" onPress={() => setOpen(true)} style={styles.listItem}><Text style={styles.bodyText}>{CATALOGO_ESPECIES.find(item => item.id === value)?.nome ?? 'Selecione um peixe'} ▾</Text></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={g.overlay}><View style={[g.dialog, { maxHeight: '80%' }]}><Text style={g.section}>Escolha o peixe</Text><ScrollView>{CATALOGO_ESPECIES.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: value === item.id }} onPress={() => { onChange(item.id); setOpen(false); }} style={styles.listItem}><Text style={styles.bodyText}>{item.nome}{value === item.id ? ' ✓' : ''}</Text></Pressable>)}</ScrollView><Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.listItem}><Text style={styles.link}>Fechar</Text></Pressable></View></View></Modal>
  </>;
}
