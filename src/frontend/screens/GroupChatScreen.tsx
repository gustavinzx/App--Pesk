import { type MensagemGrupoDto } from '../services/PeskApiClient';
import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthButton } from '../components/AuthUI';
import { Feedback } from '../components/PeskUI';
import { Text, TextInput } from '../components/Typography';
import { useGroup } from '../context/GroupContext';
import { useGroupChat } from '../hooks/useGroupChat';
import { api, useOperation, useUsuario } from '../hooks/usePesk';
import { palette, radii } from '../theme/brand';

type Photo = { uri: string; base64: string; mimeType: string };
export default function GroupChatScreen() {
  const { id, group } = useGroup();
  const user = useUsuario();
  const chat = useGroupChat(id);
  const operation = useOperation();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const list = useRef<FlatList<MensagemGrupoDto>>(null);
  const followBottom = useRef(true);
  const insets = useSafeAreaInsets();

  async function choosePhoto() {
    await operation.run(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.7, exif: false });
      if (result.canceled) return;
      const item = result.assets[0];
      if (!item.base64 || item.base64.length * 0.75 > 4 * 1024 * 1024) throw new Error('Escolha uma foto de até 4 MB.');
      const mimeType = item.mimeType ?? 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new Error('Escolha uma foto JPEG, PNG ou WebP.');
      setPhoto({ uri: item.uri, base64: item.base64, mimeType });
    });
  }
  async function send() {
    if (!text.trim() && !photo) return;
    await operation.run(async () => {
      const message = await api.enviarMensagem(id, { texto: text.trim(), ...(photo ? { fotoBase64: photo.base64, fotoMimeType: photo.mimeType } : {}) });
      followBottom.current = true;
      chat.append(message);
      setText(''); setPhoto(null);
    });
  }
  return <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 62}>
    <View style={{ paddingHorizontal: 20 }}><Feedback error={operation.error || chat.error} loading={chat.loading} />{chat.error ? <AuthButton title="Tentar novamente" onPress={chat.refresh} secondary /> : null}</View>
    <FlatList<MensagemGrupoDto> ref={list} data={chat.messages} keyExtractor={item => item.id} contentContainerStyle={[s.list, chat.messages.length === 0 && { flexGrow: 1, justifyContent: 'center' }]}
      onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; followBottom.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 100; }} scrollEventThrottle={100}
      onContentSizeChange={() => { if (followBottom.current) list.current?.scrollToEnd({ animated: false }); }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={chat.cursor ? <AuthButton title={chat.olderLoading ? 'Carregando...' : 'Mensagens anteriores'} onPress={() => { followBottom.current = false; void chat.loadOlder(); }} disabled={chat.olderLoading} secondary /> : undefined}
      ListEmptyComponent={!chat.loading && !chat.error ? <View style={s.empty}><View style={s.emptyIcon}><Feather name="message-circle" size={48} color={palette.blue} /></View><Text style={s.emptyTitle}>A conversa começa aqui</Text><Text style={s.emptyText}>Ainda não há mensagens.{String.fromCharCode(10)}Dê um oi para a turma da pescaria.</Text></View> : undefined}
      renderItem={({ item, index }) => {
        const own = item.pescadorId === user?.uid;
        const date = new Date(item.criadoEm).toLocaleDateString('pt-BR');
        const previous = index > 0 ? new Date(chat.messages[index - 1].criadoEm).toLocaleDateString('pt-BR') : null;
        return <View>
          {date !== previous && <Text style={s.date}>{date}</Text>}
          <View style={[s.bubble, own ? s.own : s.other]}>
            {!own && <Text style={s.sender}>{item.nomePescador}</Text>}
            {item.fotoUrl ? <Image source={{ uri: item.fotoUrl }} accessibilityLabel={'Foto enviada por ' + item.nomePescador} style={s.photo} resizeMode="cover" /> : null}
            {item.texto ? <Text selectable style={[s.message, own && { color: palette.lime }]}>{item.texto}</Text> : null}
            <Text style={[s.time, own && { color: '#DDE6FF' }]}>{new Date(item.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        </View>;
      }} />
    {group?.status === 'cancelado' ? <Text style={s.closed}>Este grupo foi encerrado.</Text> : <View style={s.composerWrap}>
      {photo && <View style={s.preview}><Image source={{ uri: photo.uri }} style={s.previewPhoto} /><Pressable accessibilityRole="button" accessibilityLabel="Remover foto da mensagem" onPress={() => setPhoto(null)} disabled={operation.pending} style={s.icon}><Feather name="x" size={22} color={palette.text} /></Pressable></View>}
      <View style={s.composer}>
        <TextInput accessibilityLabel="Mensagem do grupo" placeholder="Mensagem..." placeholderTextColor={palette.muted} value={text} onChangeText={setText} maxLength={2000} multiline editable={!operation.pending} style={s.input} />
        <Pressable accessibilityRole="button" accessibilityLabel="Anexar foto à mensagem" onPress={() => void choosePhoto()} disabled={operation.pending} style={s.icon}><Feather name="image" size={22} color={palette.blue} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Enviar mensagem" disabled={operation.pending || (!text.trim() && !photo)} onPress={() => void send()} style={[s.send, (operation.pending || (!text.trim() && !photo)) && { opacity: 0.4 }]}><Feather name="arrow-up" size={23} color={palette.lime} /></Pressable>
      </View>
    </View>}
  </KeyboardAvoidingView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  list: { paddingHorizontal: 18, paddingBottom: 18, width: '100%', maxWidth: 680, alignSelf: 'center' },
  empty: { alignItems: 'center', padding: 24 },
  emptyIcon: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.softBlue, marginBottom: 24 },
  emptyTitle: { fontSize: 19, fontWeight: '700', color: palette.text, marginBottom: 10, textAlign: 'center' },
  emptyText: { fontSize: 13, color: palette.muted, textAlign: 'center', lineHeight: 22 },
  date: { textAlign: 'center', color: palette.muted, fontSize: 10, marginVertical: 16 },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: radii.input, marginVertical: 5 },
  own: { backgroundColor: palette.blue, alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  other: { backgroundColor: palette.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  message: { fontSize: 14, lineHeight: 22, color: palette.text },
  sender: { color: palette.blue, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  time: { fontSize: 9, color: palette.muted, textAlign: 'right', marginTop: 6 },
  photo: { width: 200, height: 160, borderRadius: 16, marginBottom: 8 },
  composerWrap: { padding: 12, width: '100%', maxWidth: 680, alignSelf: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: radii.pill, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, padding: 6 },
  input: { flex: 1, minWidth: 0, minHeight: 44, maxHeight: 120, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: palette.text },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  send: { width: 42, height: 42, marginBottom: 1, borderRadius: 21, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' },
  preview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: palette.surface, borderRadius: radii.input, padding: 10, marginBottom: 8 },
  previewPhoto: { width: 70, height: 70, borderRadius: 16 },
  closed: { padding: 20, color: palette.muted, textAlign: 'center' },
});
