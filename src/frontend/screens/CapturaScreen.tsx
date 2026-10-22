import { Text } from '../components/Typography';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { ActionButton, Feedback, Input, Screen, styles } from '../components/PeskUI';
import { ConfirmDialog } from '../components/GroupUI';
import { useGroup } from '../context/GroupContext';
import { api, useOperation, useResource, useUsuario } from '../hooks/usePesk';

export default function CapturaScreen({ id }: { id: string }) {
  const usuario = useUsuario();
  const groupContext = useGroup();
  const loader = useCallback(() => Promise.all([api.detalheDesafio(id), api.listarRegistros(id), api.listarEspecies()]), [id]);
  const resource = useResource(loader);
  const operation = useOperation();
  const { pending: carregando, setError: setErro, setMessage: setMensagem } = operation;
  const desafioAtivo = resource.data?.[0];
  const registros = resource.data?.[1] ?? [];
  const especies = resource.data?.[2] ?? [];
  const desafioSelecionado = id;
  const [especieSelecionada, setEspecieSelecionada] = useState('');
  const [pesoCaptura, setPesoCaptura] = useState('');
  const [comprimento, setComprimento] = useState('');
  const [local, setLocal] = useState('');
  const [fotoBase64, setFotoBase64] = useState('');
  const [fotoMime, setFotoMime] = useState('image/jpeg');
  const [editandoRegistro, setEditandoRegistro] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  async function executar(operacao: () => Promise<void>, sucesso: string) {
    if (await operation.run(operacao, sucesso)) { resource.refresh(); groupContext.refresh(); }
  }
  async function escolherFoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      allowsEditing: true,
      quality: 0.65,
      exif: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setErro('O seletor não conseguiu ler a foto. Escolha outra imagem.');
      return;
    }
    if (asset.fileSize && asset.fileSize > 4 * 1024 * 1024) {
      setErro('Escolha uma imagem com até 4 MB.');
      return;
    }
    setFotoBase64(asset.base64);
    setFotoMime(asset.mimeType ?? 'image/jpeg');
    setMensagem('Foto selecionada.');
    setErro('');
  }


  async function salvarCaptura() {
    if (!desafioSelecionado) {
      setErro('Selecione um desafio primeiro.');
      return;
    }
    if (!especieSelecionada && !especies.some(item => item.ativa)) {
      setErro('Cadastre ou selecione uma espécie ativa primeiro.');
      return;
    }
    if (!fotoBase64 && !editandoRegistro) {
      setErro('Selecione uma foto de prova antes de salvar.');
      return;
    }
    await executar(
      async () => {
        const input = {
          especieId: especieSelecionada || especies.find(item => item.ativa)?.id || '',
          pesoKg: Number(pesoCaptura.replace(',', '.')),
          ...(comprimento.trim()
            ? { comprimentoCm: Number(comprimento.replace(',', '.')) }
            : {}),
          local,
          dataHora: new Date().toISOString(),
        };
        if (editandoRegistro) {
          await api.atualizarRegistro(editandoRegistro, input);
          setEditandoRegistro(null);
        } else {
          await api.criarRegistro(desafioSelecionado, {
            ...input,
            fotoBase64,
            fotoMimeType: fotoMime,
          });
        }
        setFotoBase64('');
        setPesoCaptura('');
        setComprimento('');
      },
      editandoRegistro ? 'Captura atualizada.' : 'Captura registrada.'
    );
  }


  function removerCaptura(id: string) { setDeleteId(id); }
  return <>
    <Screen title="Registrar captura" subtitle="Cada captura conta uma história. Registre a sua com foto e peso.">
      <Feedback error={operation.error || resource.error} message={operation.message} loading={resource.loading || carregando} />
        {desafioAtivo ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Registrar captura</Text>
            <Text style={styles.label}>Espécie da captura</Text>
            {especies.filter(item => item.ativa).map(item => (
              <TouchableOpacity accessibilityRole="radio" accessibilityState={{ checked: (especieSelecionada || especies.find(value => value.ativa)?.id) === item.id }} key={item.id} onPress={() => setEspecieSelecionada(item.id)} style={[styles.listItem, (especieSelecionada || especies.find(value => value.ativa)?.id) === item.id && styles.listItemSelected]}>
                <Text style={styles.bodyText}>{item.nome}</Text>
              </TouchableOpacity>
            ))}
            {!especies.some(item => item.ativa) && <ActionButton title="CADASTRAR UMA ESPÉCIE" onPress={() => router.push('/especies')} secondary />}
            <View style={{ height: 16 }} />
            <Input
              label="Peso (kg)"
              value={pesoCaptura}
              onChangeText={setPesoCaptura}
              keyboardType="decimal-pad"
            />
            <Input
              label="Comprimento em cm (opcional)"
              value={comprimento}
              onChangeText={setComprimento}
              keyboardType="decimal-pad"
            />
            <Input label="Local" value={local} onChangeText={setLocal} />
            <ActionButton
              title={fotoBase64 ? 'TROCAR FOTO' : 'ESCOLHER FOTO DE PROVA'}
              onPress={() => void operation.run(escolherFoto)}
              secondary
            />
            {fotoBase64 ? (
              <Text style={styles.success}>
                Foto pronta para envio (
                {Math.round((fotoBase64.length * 3) / 4 / 1024)} KB)
              </Text>
            ) : null}
            {editandoRegistro ? (
              <Text style={styles.hint}>
                Editando captura existente. A foto atual será mantida.
              </Text>
            ) : null}
            <ActionButton
              title={
                editandoRegistro ? 'SALVAR ALTERAÇÕES' : 'REGISTRAR CAPTURA'
              }
              onPress={() => void salvarCaptura()}
              disabled={carregando}
            />
            {registros.map((item) => (
              <View key={item.id} style={styles.catchCard}>
                <Image
                  source={{ uri: item.fotoUrl }}
                  style={styles.catchPhoto}
                />
                <View style={styles.flex}>
                  <Text style={styles.itemTitle}>
                    {item.nomeEspecie} · {item.pesoKg} kg
                  </Text>
                  <Text style={styles.mutedText}>
                    {item.local} · {new Date(item.dataHora).toLocaleString()}
                  </Text>
                  <View style={styles.row}>
                    {item.pescadorId === usuario?.uid ? (
                      <>
                        <TouchableOpacity
                          onPress={() => {
                            setEditandoRegistro(item.id);
                            setEspecieSelecionada(item.especieId);
                            setPesoCaptura(String(item.pesoKg));
                            setComprimento(
                              item.comprimentoCm
                                ? String(item.comprimentoCm)
                                : ''
                            );
                            setLocal(item.local);
                            setFotoBase64('');
                            setMensagem(
                              'Altere os dados e salve; foto atual será mantida.'
                            );
                          }}
                        >
                          <Text style={styles.link}>EDITAR</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => void removerCaptura(item.id)}
                        >
                          <Text style={styles.dangerText}>APAGAR</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}


    </Screen>
    <ConfirmDialog visible={deleteId !== null} title="Apagar esta captura?" description="A foto e o registro serão removidos." busy={carregando} onClose={() => setDeleteId(null)} onConfirm={() => {
      if (deleteId) void executar(async () => { await api.excluirRegistro(deleteId); setDeleteId(null); }, 'Captura apagada.');
    }} />
  </>;
}
