import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthButton } from '../components/AuthUI';
import DateSheet from '../components/DateSheet';
import GroupCover, { type CoverTheme } from '../components/GroupCover';
import { Feedback } from '../components/PeskUI';
import { Text, TextInput } from '../components/Typography';
import { api, useOperation } from '../hooks/usePesk';
import { palette, radii } from '../theme/brand';
import { useGroupDirectory } from '../context/GroupDirectoryContext';

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}
function endAfter(start: Date) {
  const date = new Date(start);
  date.setDate(date.getDate() + 29);
  date.setHours(23, 59, 59, 999);
  return date;
}
const covers: CoverTheme[] = ['azul', 'lima', 'rio'];
type Photo = { uri: string; base64: string; mimeType: string };

export default function CriarGrupoScreen() {
  const [type, setType] = useState<'desafio' | 'clube'>('desafio');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState(tomorrow);
  const [end, setEnd] = useState(() => endAfter(tomorrow()));
  const [cover, setCover] = useState<CoverTheme>('azul');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [dateTarget, setDateTarget] = useState<'start' | 'end' | null>(null);
  const [scoring, setScoring] = useState(false);
  const operation = useOperation();
  const directory = useGroupDirectory();
  const duration = Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000) + 1;
  const format = (date: Date) => date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });

  async function editCover() {
    await operation.run(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, allowsEditing: true, aspect: [16, 7], quality: 0.7, exif: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) throw new Error('Não foi possível ler a imagem. Escolha outra foto.');
      if ((asset.fileSize ?? 0) > 4 * 1024 * 1024 || asset.base64.length * 0.75 > 4 * 1024 * 1024) throw new Error('Escolha uma capa de até 4 MB.');
      const mimeType = asset.mimeType ?? 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new Error('Escolha uma imagem JPEG, PNG ou WebP.');
      setPhoto({ uri: asset.uri, base64: asset.base64, mimeType });
    });
  }
  function changeDate(date: Date) {
    const next = new Date(date);
    if (dateTarget === 'start') {
      next.setHours(9, 0, 0, 0);
      if (next.toDateString() === new Date().toDateString()) next.setTime(Date.now() + 10 * 60_000);
      setStart(next);
      if (next >= end) setEnd(endAfter(next));
    } else {
      next.setHours(23, 59, 59, 999);
      setEnd(next);
    }
    setDateTarget(null);
  }
  async function create() {
    await operation.run(async () => {
      if (!name.trim()) throw new Error('Dê um nome ao seu grupo.');
      if (name.trim().length > 80) throw new Error('O nome deve ter até 80 caracteres.');
      if (type === 'desafio' && (start <= new Date() || end <= start)) throw new Error('Escolha um início no futuro e um fim depois do início.');
      const group = await api.criarGrupo({
        nome: name.trim(), descricao: description.trim(), tipo: type,
        inicio: type === 'clube' ? new Date().toISOString() : start.toISOString(),
        fim: type === 'clube' ? null : end.toISOString(),
        capaTema: cover, criteriosRanking: ['maior_peixe'],
        ...(photo ? { capaBase64: photo.base64, capaMimeType: photo.mimeType } : {}),
      });
      directory.upsert(group);
      router.replace({ pathname: '/desafio/[id]', params: { id: group.id } });
    });
  }
  function header(title: string, close: () => void, createButton = false) {
    return <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={createButton ? 'Cancelar criação do grupo' : 'Voltar à criação do grupo'} disabled={operation.pending} onPress={close} style={s.headerIcon}><Feather name={createButton ? 'x' : 'chevron-left'} size={25} color={palette.text} /></Pressable>
      <Text style={s.headerTitle}>{title}</Text>
      {createButton ? <Pressable accessibilityRole="button" accessibilityLabel="Criar grupo" disabled={operation.pending} onPress={() => void create()} style={s.create}>{operation.pending ? <ActivityIndicator color={palette.blue} /> : <Text style={s.createText}>Criar</Text>}</Pressable> : <View style={s.headerIcon} />}
    </View>;
  }

  return <SafeAreaView style={s.safe}>
    {header('Novo grupo', () => router.canGoBack() ? router.back() : router.replace('/'), true)}
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Feedback error={operation.error} />
        <GroupCover theme={cover} uri={photo?.uri}>
          <View style={s.coverActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Embaralhar capa" disabled={operation.pending} onPress={() => { setPhoto(null); setCover(covers[(covers.indexOf(cover) + 1) % covers.length]); }} style={s.coverButton}><Feather name="shuffle" size={15} color={palette.lime} /><Text style={s.coverLabel}>Embaralhar</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Editar foto de capa" disabled={operation.pending} onPress={() => void editCover()} style={s.coverButton}><Feather name="edit-2" size={15} color={palette.lime} /><Text style={s.coverLabel}>Editar</Text></Pressable>
          </View>
        </GroupCover>
        <View style={s.segment} accessibilityRole="tablist">
          {(['desafio', 'clube'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={value === 'desafio' ? 'Desafio' : 'Clube'} accessibilityState={{ selected: type === value }} disabled={operation.pending} onPress={() => setType(value)} style={[s.segmentButton, type === value && s.segmentActive]}><Feather name={value === 'desafio' ? 'award' : 'users'} size={20} color={type === value ? palette.lime : palette.text} /><Text style={[s.segmentText, type === value && { color: palette.lime }]}>{value === 'desafio' ? 'Desafio' : 'Clube'}</Text></Pressable>)}
        </View>
        <Text style={s.helper}>{type === 'desafio' ? 'Uma pescaria com data de início e fim.' : 'Um grupo contínuo, sem data para terminar.'}</Text>
        <View style={s.fieldCard}>
          <TextInput accessibilityLabel="Nome do grupo" placeholder={type === 'desafio' ? 'Ex.: Pescaria de domingo' : 'Ex.: Clube dos pescadores'} placeholderTextColor={palette.muted} maxLength={80} editable={!operation.pending} value={name} onChangeText={setName} style={s.nameInput} />
          <View style={s.divider} />
          <TextInput accessibilityLabel="Descrição do grupo" placeholder="Descrição (opcional)" placeholderTextColor={palette.muted} maxLength={500} editable={!operation.pending} value={description} onChangeText={setDescription} multiline textAlignVertical="top" style={s.descriptionInput} />
        </View>
        {type === 'desafio' && <>
          <Text style={s.section}>Datas</Text>
          <View style={s.options}>
            <Pressable accessibilityRole="button" accessibilityLabel="Data de início" disabled={operation.pending} onPress={() => setDateTarget('start')} style={s.option}><Feather name="calendar" size={23} color={palette.text} /><Text style={s.optionLabel}>Início</Text><Text style={s.optionValue}>{format(start)}</Text><Feather name="chevron-right" size={17} color={palette.muted} /></Pressable>
            <View style={s.optionDivider} />
            <Pressable accessibilityRole="button" accessibilityLabel="Data de fim" disabled={operation.pending} onPress={() => setDateTarget('end')} style={s.option}><Feather name="flag" size={23} color={palette.text} /><Text style={s.optionLabel}>Fim</Text><Text style={s.optionValue}>{format(end)}</Text><Feather name="chevron-right" size={17} color={palette.muted} /></Pressable>
          </View>
          <Text style={s.helper}>{duration} {duration === 1 ? 'dia de pescaria' : 'dias de pescaria'}</Text>
        </>}
        <Text style={s.section}>Opções</Text>
        <View style={s.options}><Pressable accessibilityRole="button" accessibilityLabel="Modo de pontuação" disabled={operation.pending} onPress={() => setScoring(true)} style={s.option}><Feather name="award" size={23} color={palette.text} /><View style={{ flex: 1 }}><Text style={s.optionLabel}>Pontuação</Text><Text style={s.scoringValue}>Maior peixe pescado</Text></View><Feather name="chevron-right" size={19} color={palette.muted} /></Pressable></View>
        <Text style={s.helper}>Vence a maior captura válida, medida pelo peso em kg.</Text>
      </ScrollView>
    </KeyboardAvoidingView>

    {dateTarget && <DateSheet key={dateTarget} title={dateTarget === 'start' ? 'Data de início' : 'Data de fim'} value={dateTarget === 'start' ? start : end} minimum={dateTarget === 'start' ? new Date() : start} onClose={() => setDateTarget(null)} onConfirm={changeDate} />}
    <Modal visible={scoring} animationType="slide" onRequestClose={() => setScoring(false)}>
      <SafeAreaView style={s.safe} accessibilityViewIsModal>
        {header('Modo de pontuação', () => setScoring(false))}
        <ScrollView contentContainerStyle={s.content}>
          <GroupCover theme={cover} uri={photo?.uri} />
          <Text style={s.scoringTitle}>Como será a disputa?</Text>
          <View style={s.options}><Pressable accessibilityRole="radio" accessibilityLabel="Maior peixe pescado" accessibilityState={{ checked: true }} onPress={() => setScoring(false)} style={s.option}><Feather name="award" size={27} color={palette.blue} /><View style={{ flex: 1 }}><Text style={s.optionLabel}>Maior peixe pescado</Text><Text style={s.scoringDescription}>A maior captura válida de cada pescador, pelo peso em kg.</Text></View><Feather name="check" size={25} color={palette.blue} /></Pressable></View>
          <Text style={s.helper}>Só a maior captura de cada participante conta para a classificação. Em caso de empate, a captura mais antiga fica à frente.</Text>
          <AuthButton title="Usar este modo" onPress={() => setScoring(false)} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  header: { paddingHorizontal: 16, minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: palette.text, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  create: { minWidth: 52, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  createText: { color: palette.blue, fontSize: 16, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 44, maxWidth: 680, width: '100%', alignSelf: 'center' },
  coverActions: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', gap: 8 },
  coverButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: '#102876CC', flexDirection: 'row', alignItems: 'center', gap: 7 },
  coverLabel: { color: palette.lime, fontSize: 11, fontWeight: '600' },
  segment: { borderRadius: radii.pill, backgroundColor: palette.surface, padding: 5, flexDirection: 'row', gap: 4 },
  segmentButton: { flex: 1, minHeight: 48, borderRadius: radii.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  segmentActive: { backgroundColor: palette.blue },
  segmentText: { color: palette.text, fontSize: 15, fontWeight: '600' },
  helper: { color: palette.muted, fontSize: 12, lineHeight: 20, marginTop: 10, marginHorizontal: 5, marginBottom: 22 },
  fieldCard: { borderRadius: radii.card, paddingHorizontal: 20, backgroundColor: palette.surface, marginBottom: 24 },
  nameInput: { minHeight: 66, color: palette.text, fontSize: 16, paddingVertical: 17 },
  divider: { height: 1, backgroundColor: palette.border },
  descriptionInput: { minHeight: 112, color: palette.text, fontSize: 14, lineHeight: 23, paddingVertical: 17 },
  section: { color: palette.muted, fontSize: 13, fontWeight: '600', marginLeft: 6, marginBottom: 12 },
  options: { borderRadius: radii.card, overflow: 'hidden', backgroundColor: palette.surface },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 20, gap: 12, minHeight: 72 },
  optionLabel: { color: palette.text, fontSize: 15, fontWeight: '600' },
  optionValue: { color: palette.muted, fontSize: 12, flex: 1, textAlign: 'right' },
  optionDivider: { height: 1, backgroundColor: palette.border, marginHorizontal: 20 },
  scoringValue: { color: palette.blue, fontSize: 12, marginTop: 5 },
  scoringTitle: { color: palette.text, fontSize: 24, fontWeight: '700', marginBottom: 22 },
  scoringDescription: { color: palette.muted, fontSize: 13, lineHeight: 21, marginTop: 6 },
});
