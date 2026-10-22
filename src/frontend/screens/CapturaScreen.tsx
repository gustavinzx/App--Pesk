import { router, useLocalSearchParams, type Href } from 'expo-router';
import { usePendingGroupRefresh } from '../hooks/usePendingGroupRefresh';
import { Text } from '../components/Typography';
import * as ImagePicker from 'expo-image-picker';
import SpeciesSelect from '../components/SpeciesSelect';
import { useCallback, useState } from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { ActionButton, Feedback, Input, Screen, styles } from '../components/PeskUI';
import { ConfirmDialog, periodLabel } from '../components/GroupUI';
import { useGroup } from '../context/GroupContext';
import { api, useOperation, useResource, useUsuario } from '../hooks/usePesk';

export default function CapturaScreen({ id }: { id: string }) {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const usuario = useUsuario();
  const groupContext = useGroup();
  const loader = useCallback(() => Promise.all([api.detalheDesafio(id), api.listarRegistros(id)]), [id]);
  const resource = useResource(loader);
  const operation = useOperation();
  const { pending: carregando, setError: setErro, setMessage: setMensagem } = operation;
  const desafioAtivo = resource.data?.[0];
  usePendingGroupRefresh(desafioAtivo?.status === 'aberto', resource.refresh);
  const registros = resource.data?.[1] ?? [];
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
    const ok = await operation.run(operacao, sucesso);
    if (ok) { resource.refresh(); groupContext.refresh(); }
    return ok;
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
    if (!especieSelecionada) {
      setErro('Selecione uma espécie da lista primeiro.');
      return;
    }
    if (!fotoBase64 && !editandoRegistro) {
      setErro('Selecione uma foto de prova antes de salvar.');
      return;
    }
    const novaCaptura = !editandoRegistro;
    const salvo = await executar(
      async () => {
        const input = {
          especieId: especieSelecionada,
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
    if (salvo && novaCaptura) {
      if (returnTo && /^\/(?!\/)/.test(returnTo)) router.dismissTo(returnTo as Href);
      else if (router.canGoBack()) router.back();
      else router.replace({ pathname: '/desafio/[id]', params: { id } });
    }
  }


  function removerCaptura(id: string) { setDeleteId(id); }
  return <>
    <Screen title="Registrar captura" subtitle="Cada captura conta uma história. Registre a sua com foto e peso.">
      <Feedback error={operation.error || resource.error} message={operation.message} loading={resource.loading || carregando} />
        {desafioAtivo ? <><Text style={styles.cardTitle}>{desafioAtivo.nome}</Text><Text style={styles.hint}>{periodLabel(desafioAtivo)} · {desafioAtivo.participantes.length} participantes</Text></> : null}
        {desafioAtivo && desafioAtivo.status !== 'ativo' ? <Text style={styles.hint}>{desafioAtivo.status === 'aberto' ? 'Aguardando o horário de início informado acima. O desafio precisa de pelo menos dois participantes.' : desafioAtivo.status === 'cancelado' ? 'Este grupo foi cancelado. O registro de capturas está indisponível.' : 'O prazo deste grupo terminou.'}</Text> : null}
        <ActionButton title="ATUALIZAR STATUS DO GRUPO" onPress={resource.refresh} secondary disabled={resource.loading} />
        {desafioAtivo?.status === 'ativo' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Registrar captura</Text>
            <Text style={styles.label}>Espécie da captura</Text>
            <SpeciesSelect value={especieSelecionada} onChange={setEspecieSelecionada} />
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
