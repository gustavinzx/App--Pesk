import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { CATALOGO_ESPECIES } from '../../core/domain/catalogoEspecies';
import { ActionButton, Feedback, Input, Screen, styles } from '../components/PeskUI';
import FishIllustration from '../components/FishIllustration';
import { Text } from '../components/Typography';
import { api, useResource, useUsuario } from '../hooks/usePesk';
import { palette, radii } from '../theme/brand';
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const load = async () => {
  const groups = await api.listarDesafios();
  return (await Promise.all(groups.map(group => api.listarRegistros(group.id)))).flat();
};
export default function EspeciesScreen() {
  const resource = useResource(load);
  const user = useUsuario();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const records = (resource.data ?? []).filter(item => item.pescadorId === user?.uid && item.status === 'valido');
  const collection = CATALOGO_ESPECIES.map(species => ({ species, catches: records.filter(item => item.especieId === species.id || normalize(item.nomeEspecie) === normalize(species.nome)) }));
  const unlocked = collection.filter(item => item.catches.length > 0).length;
  const detail = collection.find(item => item.species.id === selected);
  const visible = collection.filter(({ species }) => normalize(species.nome).includes(normalize(query)));
  return <>
    <Screen title="Samburá" subtitle="Cada peixe, uma história. Sua coleção começa aqui.">
      <Feedback error={resource.error} loading={resource.loading} />
      <Text style={styles.cardTitle}>{resource.error || resource.loading ? 'Consultando sua coleção...' : unlocked + ' de 10 espécies pescadas'}</Text>
      <Input label="Pesquisar no Samburá" value={query} onChangeText={setQuery} placeholder="Nome do peixe" />
      <ActionButton title="ATUALIZAR SAMBURÁ" secondary onPress={resource.refresh} />
      <View style={s.grid}>{visible.map(({ species, catches }) => <Pressable key={species.id} accessibilityRole="button" accessibilityLabel={'Ver capturas de ' + species.nome} onPress={() => setSelected(species.id)} style={s.card}>
        <FishIllustration />
        <View style={s.info}><Text style={s.number}>#{String(CATALOGO_ESPECIES.indexOf(species) + 1).padStart(2, '0')}</Text><Text style={s.name}>{species.nome}</Text><Text style={s.count}>{resource.loading || resource.error ? '—' : catches.length} {catches.length === 1 ? 'peixe capturado' : 'peixes capturados'}</Text></View>
      </Pressable>)}</View>
      {visible.length === 0 && <Text style={styles.bodyText}>Nenhuma espécie encontrada.</Text>}
    </Screen>
    <Modal visible={Boolean(detail)} animationType="slide" onRequestClose={() => setSelected(null)}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Voltar ao Samburá" onPress={() => setSelected(null)} style={s.back}><Feather name="chevron-left" size={26} color={palette.text} /></Pressable><Text style={s.heading}>{detail?.species.nome}</Text><View style={s.back} /></View>
        <ScrollView contentContainerStyle={s.content}>
          <View style={s.hero}><FishIllustration /></View>
          <Text style={s.heading}>Suas capturas</Text>
          <Feedback loading={resource.loading} error={resource.error} />
          {detail?.catches.length === 0 && !resource.error && !resource.loading && <Text style={styles.bodyText}>Você ainda não registrou este peixe. Registre uma pesca no botão + para começar sua coleção.</Text>}
          {[...(detail?.catches ?? [])].sort((a,b) => b.dataHora.localeCompare(a.dataHora)).map(item => <View key={item.id} style={s.catch}>
            <Image source={{ uri: item.fotoUrl }} accessibilityLabel={'Captura de ' + item.nomeEspecie} style={s.photo} />
            <View style={{ flex: 1 }}><Text style={s.weight}>{item.pesoKg.toFixed(2)} kg</Text><Text style={s.length}>{item.comprimentoCm !== undefined ? item.comprimentoCm + ' cm' : 'Tamanho não informado'}</Text><Text style={s.meta}>{new Date(item.dataHora).toLocaleDateString('pt-BR')} · {item.local}</Text></View>
          </View>)}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </>;
}
const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  card: { width: '47.5%', flexGrow: 0, borderRadius: radii.card, overflow: 'hidden', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, marginBottom: 4 },
  info: { minHeight: 132, padding: 14, justifyContent: 'center' },
  number: { fontSize: 10, color: palette.muted, marginBottom: 5 },
  name: { fontSize: 17, fontWeight: '700', color: palette.text },
  count: { fontSize: 11, lineHeight: 18, color: palette.muted, marginTop: 12 },
  safe: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  back: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '700', color: palette.text, marginBottom: 12 },
  content: { padding: 20, maxWidth: 680, alignSelf: 'center', width: '100%', paddingBottom: 40 },
  hero: { borderRadius: radii.card, overflow: 'hidden', marginBottom: 24 },
  catch: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: radii.card, padding: 14, gap: 14, marginTop: 12 },
  photo: { width: 68, height: 76, borderRadius: 18 },
  weight: { fontSize: 20, fontWeight: '700', color: palette.blue },
  length: { fontSize: 14, color: palette.text, marginTop: 4 },
  meta: { fontSize: 11, color: palette.muted, marginTop: 7, lineHeight: 18 },
});
