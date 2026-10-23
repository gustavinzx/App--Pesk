import { useState } from 'react';
import { Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { updateProfile } from 'firebase/auth';
import { auth } from '../backend/config/firebase';
import AuthGate from '../frontend/components/AuthGate';
import { ActionButton, Feedback, Input, Screen, styles } from '../frontend/components/PeskUI';
import { Text } from '../frontend/components/Typography';
import { useProfile } from '../frontend/context/ProfileContext';
import { api, useOperation, useUsuario } from '../frontend/hooks/usePesk';
function Editor() {
  const user = useUsuario();
  const { profile, update, error, refresh } = useProfile();
  const operation = useOperation();
  const [name, setName] = useState(profile?.nome ?? user?.displayName ?? '');
  const [description, setDescription] = useState(profile?.descricao ?? '');
  const [photo, setPhoto] = useState<{ uri: string; base64: string; mime: string } | null>(null);
  async function choose() {
    await operation.run(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true });
      if (result.canceled) return;
      const item = result.assets[0];
      if (!item.base64 || item.base64.length > 5592408) throw new Error('Escolha uma foto de até 4 MB.');
      const mime = item.mimeType ?? 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new Error('Escolha uma foto JPEG, PNG ou WebP.');
      setPhoto({ uri: item.uri, base64: item.base64, mime });
    });
  }
  async function save() {
    await operation.run(async () => {
      if (!name.trim()) throw new Error('Informe seu nome.');
      const saved = await api.salvarPerfil({ nome: name.trim(), descricao: description.trim(), ...(photo ? { fotoBase64: photo.base64, fotoMimeType: photo.mime } : {}) });
      update(saved);
      setPhoto(null);
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: saved.nome });
    }, 'Perfil atualizado.');
  }
  const uri = photo?.uri || profile?.fotoUrl || user?.photoURL;
  return <Screen title="Seu perfil" subtitle="Do seu jeito, dentro e fora da pescaria.">
    <Feedback error={operation.error || error} message={operation.message} loading={operation.pending} />
    {error ? <ActionButton title="TENTAR CONECTAR NOVAMENTE" secondary onPress={() => void refresh()} /> : null}
    <View style={[styles.card, { alignItems: 'center' }]}>{uri ? <Image source={{ uri }} accessibilityLabel="Foto do perfil" style={{ width: 112, height: 112, borderRadius: 56 }} /> : <Text style={{ fontSize: 42 }}>{name.charAt(0).toUpperCase()}</Text>}<ActionButton title="ALTERAR FOTO" secondary onPress={() => void choose()} disabled={operation.pending} /></View>
    <Input label="Nome" value={name} onChangeText={setName} maxLength={100} />
    <Input label="Descrição" value={description} onChangeText={setDescription} maxLength={500} multiline placeholder="Conte um pouco sobre você e suas pescarias" />
    <ActionButton title="SALVAR PERFIL" onPress={() => void save()} disabled={operation.pending} />
  </Screen>;
}
export default function Route() {
  const { profile } = useProfile();
  return <AuthGate><Editor key={profile?.id ?? 'loading'} /></AuthGate>;
}
