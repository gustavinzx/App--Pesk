import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../../backend/config/firebase';
import type {
  DesafioDetalheDto,
  DesafioDto,
  EspecieDto,
  RegistroDto,
} from '../services/PeskApiClient';
import { PeskApiClient } from '../services/PeskApiClient';

const api = new PeskApiClient();
const COLORS = {
  background: '#071311',
  surface: '#0F211C',
  surfaceAlt: '#091613',
  border: '#1A3830',
  accent: '#00E599',
  text: '#F5FBF8',
  muted: '#8BA59B',
  danger: '#FCA5A5',
};

function dataLocal(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'email-address';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#647E74"
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

function ActionButton({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.82}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.buttonSecondary,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[styles.buttonText, secondary && styles.buttonSecondaryText]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function CompeticoesScreen({
  onIrCadastro,
}: {
  onIrCadastro?: () => void;
}) {
  const [usuario, setUsuario] = useState(auth.currentUser);
  const [emailLogin, setEmailLogin] = useState('');
  const [senhaLogin, setSenhaLogin] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [desafios, setDesafios] = useState<DesafioDto[]>([]);
  const [especies, setEspecies] = useState<EspecieDto[]>([]);
  const [desafioSelecionado, setDesafioSelecionado] = useState<string | null>(
    null
  );
  const [detalhe, setDetalhe] = useState<DesafioDetalheDto | null>(null);
  const [registros, setRegistros] = useState<RegistroDto[]>([]);

  const [nomeDesafio, setNomeDesafio] = useState('Pescaria de teste');
  const [inicioDesafio, setInicioDesafio] = useState(
    dataLocal(new Date(Date.now() + 2 * 60 * 1000))
  );
  const [fimDesafio, setFimDesafio] = useState(
    dataLocal(new Date(Date.now() + 2 * 60 * 60 * 1000))
  );
  const [codigoConvite, setCodigoConvite] = useState('');
  const [nomeEspecie, setNomeEspecie] = useState('Tucunaré');
  const [pesoMaximo, setPesoMaximo] = useState('20');
  const [especieSelecionada, setEspecieSelecionada] = useState('');
  const [pesoCaptura, setPesoCaptura] = useState('1.25');
  const [comprimento, setComprimento] = useState('');
  const [local, setLocal] = useState('Lago');
  const [fotoBase64, setFotoBase64] = useState('');
  const [fotoMime, setFotoMime] = useState('image/jpeg');
  const [editandoRegistro, setEditandoRegistro] = useState<string | null>(null);
  const [editandoDesafio, setEditandoDesafio] = useState(false);

  const desafioAtivo = useMemo(
    () => desafios.find((desafio) => desafio.id === desafioSelecionado),
    [desafios, desafioSelecionado]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUsuario);
    return unsubscribe;
  }, []);

  const carregarDados = useCallback(async () => {
    if (!auth.currentUser) return;
    setErro('');
    try {
      const [listaDesafios, listaEspecies] = await Promise.all([
        api.listarDesafios(),
        api.listarEspecies(),
      ]);
      setDesafios(listaDesafios);
      setEspecies(listaEspecies);
      if (!especieSelecionada && listaEspecies[0]) {
        setEspecieSelecionada(listaEspecies[0].id);
      }
      if (desafioSelecionado) {
        const atual = listaDesafios.find(
          (item) => item.id === desafioSelecionado
        );
        if (atual) {
          const [detalheAtual, registrosAtuais] = await Promise.all([
            api.detalheDesafio(atual.id),
            api.listarRegistros(atual.id),
          ]);
          setDetalhe(detalheAtual);
          setRegistros(registrosAtuais);
        }
      }
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os dados.'
      );
    }
  }, [desafioSelecionado, especieSelecionada]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados, usuario]);

  async function executar(operacao: () => Promise<void>, sucesso: string) {
    setCarregando(true);
    setErro('');
    setMensagem('');
    try {
      await operacao();
      setMensagem(sucesso);
      await carregarDados();
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'
      );
    } finally {
      setCarregando(false);
    }
  }

  async function entrar() {
    await executar(async () => {
      await signInWithEmailAndPassword(auth, emailLogin.trim(), senhaLogin);
      setUsuario(auth.currentUser);
    }, 'Login realizado.');
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

  async function criarDesafio() {
    await executar(async () => {
      const novo = await api.criarDesafio({
        nome: nomeDesafio,
        inicio: new Date(inicioDesafio).toISOString(),
        fim: new Date(fimDesafio).toISOString(),
      });
      setDesafioSelecionado(novo.id);
      setCodigoConvite(novo.codigoConvite);
      setMensagem(`Desafio criado. Código de convite: ${novo.codigoConvite}`);
    }, 'Desafio criado.');
  }

  async function salvarAlteracaoDesafio() {
    if (!desafioSelecionado) return;
    await executar(async () => {
      await api.atualizarDesafio(desafioSelecionado, {
        nome: nomeDesafio,
        inicio: new Date(inicioDesafio).toISOString(),
        fim: new Date(fimDesafio).toISOString(),
      });
      setEditandoDesafio(false);
    }, 'Desafio atualizado.');
  }

  async function cancelarDesafio() {
    if (!desafioSelecionado) return;
    Alert.alert('Cancelar desafio?', 'Essa ação não pode ser desfeita.', [
      { text: 'Manter', style: 'cancel' },
      {
        text: 'Cancelar desafio',
        style: 'destructive',
        onPress: () => {
          void executar(
            () => api.cancelarDesafio(desafioSelecionado),
            'Desafio cancelado.'
          );
        },
      },
    ]);
  }

  async function criarEspecie() {
    await executar(async () => {
      const nova = await api.criarEspecie({
        nome: nomeEspecie,
        pesoMaxReferenciaKg: Number(pesoMaximo.replace(',', '.')),
      });
      setEspecieSelecionada(nova.id);
    }, 'Espécie cadastrada.');
  }

  async function alternarAtivaEspecie(especie: EspecieDto) {
    await executar(
      () =>
        api
          .atualizarEspecie(especie.id, {
            nome: especie.nome,
            pesoMaxReferenciaKg: especie.pesoMaxReferenciaKg,
            ativa: !especie.ativa,
          })
          .then(() => undefined),
      especie.ativa ? 'Espécie desativada.' : 'Espécie ativada.'
    );
  }

  async function entrarPorConvite() {
    await executar(async () => {
      await api.entrarDesafio(codigoConvite);
      setCodigoConvite('');
    }, 'Você entrou no desafio.');
  }

  async function selecionarDesafio(id: string) {
    setDesafioSelecionado(id);
    setErro('');
    try {
      const [challenge, catches] = await Promise.all([
        api.detalheDesafio(id),
        api.listarRegistros(id),
      ]);
      setDetalhe(challenge);
      setRegistros(catches);
      setDesafios((current) =>
        current.map((item) =>
          item.id === id ? { ...item, ...challenge } : item
        )
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível abrir o desafio.'
      );
    }
  }

  async function salvarCaptura() {
    if (!desafioSelecionado) {
      setErro('Selecione um desafio primeiro.');
      return;
    }
    if (!fotoBase64 && !editandoRegistro) {
      setErro('Selecione uma foto de prova antes de salvar.');
      return;
    }
    await executar(
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
  }

  async function removerCaptura(id: string) {
    Alert.alert('Apagar captura?', 'A foto e o registro serão removidos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => {
          void executar(() => api.excluirRegistro(id), 'Captura apagada.');
        },
      },
    ]);
  }

  if (!usuario) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.authContent}>
            <Text style={styles.brand}>
              PESK<Text style={styles.accent}>.</Text>
            </Text>
            <Text style={styles.heading}>Área de testes</Text>
            <Text style={styles.subtitle}>
              Entre com uma conta criada no Firebase Authentication para testar
              desafios e capturas.
            </Text>
            {erro ? <Text style={styles.error}>{erro}</Text> : null}
            {mensagem ? <Text style={styles.success}>{mensagem}</Text> : null}
            <Input
              label="E-mail"
              value={emailLogin}
              onChangeText={setEmailLogin}
              placeholder="voce@email.com"
              keyboardType="email-address"
            />
            <Input
              label="Senha"
              value={senhaLogin}
              onChangeText={setSenhaLogin}
              placeholder="Sua senha"
            />
            <ActionButton
              title={carregando ? 'ENTRANDO...' : 'ENTRAR'}
              onPress={() => void entrar()}
              disabled={carregando}
            />
            {onIrCadastro ? (
              <TouchableOpacity
                onPress={onIrCadastro}
                style={styles.backButton}
              >
                <Text style={styles.link}>VOLTAR AO CADASTRO</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.hint}>
              Use a mesma conta Firebase cadastrada na tela inicial. Para testar
              convite entre participantes, entre primeiro com um usuário, copie
              o código do desafio e depois autentique o segundo usuário no mesmo
              app.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brandSmall}>
              PESK<Text style={styles.accent}>.</Text>
            </Text>
            <Text style={styles.mutedText}>{usuario.email}</Text>
          </View>
          <TouchableOpacity
            onPress={() => void signOut(auth)}
            style={styles.signOutButton}
          >
            <Text style={styles.signOutText}>SAIR</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.heading}>Competições</Text>
        <Text style={styles.subtitle}>
          Crie um desafio, convide alguém e registre a pescaria.
        </Text>
        {erro ? <Text style={styles.error}>{erro}</Text> : null}
        {mensagem ? <Text style={styles.success}>{mensagem}</Text> : null}
        {carregando ? (
          <ActivityIndicator color={COLORS.accent} style={styles.loader} />
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Criar desafio</Text>
          <Input
            label="Nome"
            value={nomeDesafio}
            onChangeText={setNomeDesafio}
          />
          <Input
            label="Início (data e hora local)"
            value={inicioDesafio}
            onChangeText={setInicioDesafio}
            placeholder="AAAA-MM-DDTHH:mm"
          />
          <Input
            label="Fim (data e hora local)"
            value={fimDesafio}
            onChangeText={setFimDesafio}
            placeholder="AAAA-MM-DDTHH:mm"
          />
          <ActionButton
            title="CRIAR DESAFIO"
            onPress={() => void criarDesafio()}
            disabled={carregando}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Entrar por convite</Text>
          <Input
            label="Código de convite"
            value={codigoConvite}
            onChangeText={setCodigoConvite}
            placeholder="Ex.: AB12CD"
          />
          <ActionButton
            title="ENTRAR NO DESAFIO"
            onPress={() => void entrarPorConvite()}
            secondary
            disabled={carregando}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Meus desafios</Text>
            <TouchableOpacity onPress={() => void carregarDados()}>
              <Text style={styles.link}>ATUALIZAR</Text>
            </TouchableOpacity>
          </View>
          {desafios.length === 0 ? (
            <Text style={styles.mutedText}>Nenhum desafio encontrado.</Text>
          ) : null}
          {desafios.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => void selecionarDesafio(item.id)}
              style={[
                styles.listItem,
                desafioSelecionado === item.id && styles.listItemSelected,
              ]}
            >
              <View style={styles.flex}>
                <Text style={styles.itemTitle}>{item.nome}</Text>
                <Text style={styles.mutedText}>
                  Convite: {item.codigoConvite} · {item.status}
                </Text>
              </View>
              <Text style={styles.link}>ABRIR</Text>
            </TouchableOpacity>
          ))}
        </View>

        {desafioAtivo ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Desafio selecionado</Text>
            <Text style={styles.itemTitle}>{desafioAtivo.nome}</Text>
            <Text style={styles.mutedText}>
              Código para convidar: {desafioAtivo.codigoConvite}
            </Text>
            <Text style={styles.mutedText}>
              Status: {detalhe?.status ?? desafioAtivo.status}
            </Text>
            {detalhe ? (
              <>
                {desafioAtivo.donoId === usuario.uid &&
                desafioAtivo.status === 'aberto' ? (
                  <View style={styles.row}>
                    <TouchableOpacity
                      onPress={() => {
                        setNomeDesafio(desafioAtivo.nome);
                        setInicioDesafio(
                          dataLocal(new Date(desafioAtivo.inicio))
                        );
                        setFimDesafio(dataLocal(new Date(desafioAtivo.fim)));
                        setEditandoDesafio(true);
                      }}
                    >
                      <Text style={styles.link}>EDITAR DESAFIO</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => void cancelarDesafio()}>
                      <Text style={styles.dangerText}>CANCELAR</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {editandoDesafio ? (
                  <View style={styles.editChallenge}>
                    <Input
                      label="Nome"
                      value={nomeDesafio}
                      onChangeText={setNomeDesafio}
                    />
                    <Input
                      label="Início"
                      value={inicioDesafio}
                      onChangeText={setInicioDesafio}
                    />
                    <Input
                      label="Fim"
                      value={fimDesafio}
                      onChangeText={setFimDesafio}
                    />
                    <ActionButton
                      title="SALVAR DESAFIO"
                      onPress={() => void salvarAlteracaoDesafio()}
                      disabled={carregando}
                    />
                  </View>
                ) : null}
                <Text style={styles.sectionTitle}>
                  Participantes ({detalhe.participantes.length})
                </Text>
                {detalhe.participantes.map((participant) => (
                  <Text key={participant.id} style={styles.bodyText}>
                    • {participant.nomePescador}
                  </Text>
                ))}
                <Text style={styles.sectionTitle}>Ranking por peso</Text>
                {detalhe.rankingPesoTotal.map((rank, index) => (
                  <Text key={rank.pescadorId} style={styles.bodyText}>
                    {index + 1}. {rank.nomePescador} —{' '}
                    {rank.pesoTotalKg.toFixed(2)} kg ({rank.quantidadePeixes}{' '}
                    peixes)
                  </Text>
                ))}
                {detalhe.melhorPeixe ? (
                  <Text style={styles.bodyText}>
                    Melhor peixe: {detalhe.melhorPeixe.nomePescador} ·{' '}
                    {detalhe.melhorPeixe.nomeEspecie} ·{' '}
                    {detalhe.melhorPeixe.pesoKg} kg
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. Cadastrar espécie</Text>
          <Text style={styles.hint}>
            Necessária antes de registrar uma captura. Para um primeiro teste,
            crie Tucunaré com peso máximo de 20 kg.
          </Text>
          <Input
            label="Espécie"
            value={nomeEspecie}
            onChangeText={setNomeEspecie}
          />
          <Input
            label="Peso máximo de referência (kg)"
            value={pesoMaximo}
            onChangeText={setPesoMaximo}
            keyboardType="decimal-pad"
          />
          <ActionButton
            title="CADASTRAR ESPÉCIE"
            onPress={() => void criarEspecie()}
            secondary
            disabled={carregando}
          />
          {especies.map((item) => (
            <View
              key={item.id}
              style={[
                styles.listItem,
                especieSelecionada === item.id && styles.listItemSelected,
              ]}
            >
              <TouchableOpacity
                disabled={!item.ativa}
                onPress={() => setEspecieSelecionada(item.id)}
                style={styles.flex}
              >
                <Text style={styles.bodyText}>
                  {item.nome} · até {item.pesoMaxReferenciaKg} kg{' '}
                  {item.ativa ? '' : '(inativa)'}
                </Text>
              </TouchableOpacity>
              <View style={styles.row}>
                <Text style={styles.link}>
                  {especieSelecionada === item.id ? 'SELECIONADA' : 'USAR'}
                </Text>
                <TouchableOpacity
                  onPress={() => void alternarAtivaEspecie(item)}
                >
                  <Text style={item.ativa ? styles.dangerText : styles.link}>
                    {item.ativa ? 'DESATIVAR' : 'ATIVAR'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {desafioAtivo ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>4. Registrar captura</Text>
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
              onPress={() => void escolherFoto()}
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
                    {item.pescadorId === usuario.uid ? (
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  fill: { flex: 1 },
  authContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  content: { padding: 20, paddingBottom: 56 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  brand: {
    color: COLORS.text,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 4,
  },
  brandSmall: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
  },
  accent: { color: COLORS.accent },
  heading: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 4,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 8,
  },
  field: { marginBottom: 13 },
  label: { color: '#D2E3DC', fontSize: 12, fontWeight: '700', marginBottom: 7 },
  input: {
    color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
    borderColor: '#24453C',
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 15,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 11,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonSecondary: {
    backgroundColor: '#17372D',
    borderColor: '#2A5D4B',
    borderWidth: 1,
  },
  buttonText: {
    color: '#071311',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  buttonSecondaryText: { color: COLORS.accent },
  buttonDisabled: { opacity: 0.55 },
  backButton: { alignItems: 'center', paddingVertical: 14 },
  signOutButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 9,
  },
  signOutText: { color: COLORS.accent, fontSize: 11, fontWeight: '800' },
  mutedText: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  bodyText: { color: '#D2E3DC', fontSize: 14, lineHeight: 22, marginBottom: 4 },
  itemTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  hint: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  error: {
    color: COLORS.danger,
    backgroundColor: '#2A1316',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    lineHeight: 19,
  },
  success: {
    color: COLORS.accent,
    fontSize: 13,
    lineHeight: 19,
    marginVertical: 8,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
    gap: 12,
  },
  listItemSelected: { borderColor: COLORS.accent, backgroundColor: '#10271F' },
  link: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  dangerText: { color: COLORS.danger, fontSize: 11, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 18, marginTop: 9 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flex: { flex: 1 },
  loader: { marginBottom: 10 },
  catchCard: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 12,
  },
  editChallenge: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  catchPhoto: {
    width: 74,
    height: 74,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
  },
});
