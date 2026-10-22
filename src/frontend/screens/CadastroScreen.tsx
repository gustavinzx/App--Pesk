import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
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
import { isFirebaseConfigured } from '../../backend/config/firebase';
import {
  CadastrarUsuarioService,
  ErroValidacao,
} from '../../core/business/CadastrarUsuarioService';
import { makeCadastrarUsuarioService } from '../factories/makeCadastrarUsuarioService';

interface CadastroScreenProps {
  service?: CadastrarUsuarioService;
  onAbrirTestes?: () => void;
}

export default function CadastroScreen({
  service,
  onAbrirTestes,
}: CadastroScreenProps) {
  // Permite injeção de dependência para testes, com fallback para factory padrão
  const cadastrarUsuarioService = service || makeCadastrarUsuarioService();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacaoSenha, setConfirmacaoSenha] = useState('');

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);

  const [carregando, setCarregando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [sucessoInfo, setSucessoInfo] = useState<{
    id: string;
    nome: string;
    email: string;
  } | null>(null);

  function limparErros() {
    if (mensagemErro) {
      setMensagemErro(null);
    }
  }

  async function handleCadastrar() {
    if (carregando) return;
    setMensagemErro(null);
    setCarregando(true);

    try {
      const resultado = await cadastrarUsuarioService.executar({
        nome,
        email,
        senha,
        confirmacaoSenha,
      });

      setSucessoInfo({
        id: resultado.id,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
      });

      setNome('');
      setEmail('');
      setSenha('');
      setConfirmacaoSenha('');
    } catch (erro: any) {
      if (erro instanceof ErroValidacao) {
        setMensagemErro(erro.message);
      } else if (erro instanceof Error) {
        setMensagemErro(erro.message);
      } else {
        setMensagemErro(
          'Não foi possível realizar o cadastro. Tente novamente.'
        );
      }
    } finally {
      setCarregando(false);
    }
  }

  function handleNovoCadastro() {
    setSucessoInfo(null);
    setMensagemErro(null);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header & Identidade Visual do Pesk */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <Text style={styles.logoText}>PESK</Text>
              <View style={styles.logoDot} />
              <View style={styles.badgeClub}>
                <Text style={styles.badgeClubText}>FISHING CLUB</Text>
              </View>
            </View>
            <Text style={styles.tagline}>
              Competições, registros de capturas e estatísticas de pesca entre
              amigos.
            </Text>
          </View>

          {/* Aviso informativo caso o Firebase ainda não tenha credenciais no .env */}
          {!isFirebaseConfigured && (
            <View style={styles.configAlert}>
              <View style={styles.configAlertDot} />
              <View style={styles.configAlertContent}>
                <Text style={styles.configAlertTitle}>
                  Ambiente de Demonstração
                </Text>
                <Text style={styles.configAlertText}>
                  As variáveis do Firebase não foram encontradas no arquivo
                  .env. Para conectar ao seu banco real, preencha o arquivo .env
                  com base em .env.example.
                </Text>
              </View>
            </View>
          )}

          {/* Tela de Sucesso */}
          {sucessoInfo ? (
            <View style={styles.cardSucesso}>
              <View style={styles.sucessoIconContainer}>
                <Text style={styles.sucessoIcon}>✓</Text>
              </View>
              <Text style={styles.sucessoTitle}>Pescador Cadastrado!</Text>
              <Text style={styles.sucessoSubtitle}>
                Sua conta foi criada no Firebase Authentication e seu perfil foi
                registrado com sucesso pela API do Pesk.
              </Text>

              <View style={styles.sucessoDetails}>
                <View style={styles.sucessoDetailRow}>
                  <Text style={styles.sucessoDetailLabel}>Nome:</Text>
                  <Text style={styles.sucessoDetailValue}>
                    {sucessoInfo.nome}
                  </Text>
                </View>
                <View style={styles.sucessoDetailRow}>
                  <Text style={styles.sucessoDetailLabel}>E-mail:</Text>
                  <Text style={styles.sucessoDetailValue}>
                    {sucessoInfo.email}
                  </Text>
                </View>
                <View style={styles.sucessoDetailRow}>
                  <Text style={styles.sucessoDetailLabel}>UID:</Text>
                  <Text style={styles.sucessoDetailValue} numberOfLines={1}>
                    {sucessoInfo.id}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                style={styles.buttonNovoCadastro}
                onPress={handleNovoCadastro}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonNovoCadastroText}>
                  CADASTRAR OUTRO USUÁRIO
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Formulário de Cadastro */
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Novo Pescador</Text>
              <Text style={styles.formSubtitle}>
                Preencha os dados abaixo para iniciar sua jornada competitiva.
              </Text>

              {/* Mensagem de Erro Inline */}
              {mensagemErro && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{mensagemErro}</Text>
                </View>
              )}

              {/* Campo Nome */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome completo</Text>
                <TextInput
                  accessibilityLabel="Nome completo"
                  style={styles.input}
                  placeholder="Ex: Carlos Eduardo"
                  placeholderTextColor="#647E74"
                  value={nome}
                  onChangeText={(text) => {
                    setNome(text);
                    limparErros();
                  }}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!carregando}
                  returnKeyType="next"
                />
              </View>

              {/* Campo E-mail */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  accessibilityLabel="E-mail"
                  style={styles.input}
                  placeholder="voce@exemplo.com"
                  placeholderTextColor="#647E74"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    limparErros();
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!carregando}
                  returnKeyType="next"
                />
              </View>

              {/* Campo Senha */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Senha</Text>
                <View style={styles.inputWithAction}>
                  <TextInput
                    accessibilityLabel="Senha"
                    style={[styles.input, styles.inputFlex]}
                    placeholder="Mínimo de 6 caracteres"
                    placeholderTextColor="#647E74"
                    value={senha}
                    onChangeText={(text) => {
                      setSenha(text);
                      limparErros();
                    }}
                    secureTextEntry={!mostrarSenha}
                    autoCapitalize="none"
                    editable={!carregando}
                    returnKeyType="next"
                  />
                  <TouchableOpacity
                    style={styles.togglePasswordButton}
                    onPress={() => setMostrarSenha(!mostrarSenha)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.togglePasswordText}>
                      {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Campo Confirmação de Senha */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmar senha</Text>
                <View style={styles.inputWithAction}>
                  <TextInput
                    accessibilityLabel="Confirmar senha"
                    style={[styles.input, styles.inputFlex]}
                    placeholder="Repita a mesma senha"
                    placeholderTextColor="#647E74"
                    value={confirmacaoSenha}
                    onChangeText={(text) => {
                      setConfirmacaoSenha(text);
                      limparErros();
                    }}
                    secureTextEntry={!mostrarConfirmacao}
                    autoCapitalize="none"
                    editable={!carregando}
                    returnKeyType="done"
                    onSubmitEditing={handleCadastrar}
                  />
                  <TouchableOpacity
                    style={styles.togglePasswordButton}
                    onPress={() => setMostrarConfirmacao(!mostrarConfirmacao)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.togglePasswordText}>
                      {mostrarConfirmacao ? 'Ocultar' : 'Mostrar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Botão de Cadastro */}
              <TouchableOpacity
                accessibilityRole="button"
                style={[
                  styles.buttonSubmit,
                  carregando && styles.buttonDisabled,
                ]}
                onPress={handleCadastrar}
                disabled={carregando}
                activeOpacity={0.85}
              >
                {carregando ? (
                  <View style={styles.buttonLoadingRow}>
                    <ActivityIndicator size="small" color="#071311" />
                    <Text style={styles.buttonSubmitText}>
                      CRIANDO CONTA...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.buttonSubmitText}>CRIAR CONTA PESK</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.footerNotice}>
                Ao se cadastrar, sua identidade será validada pelo Firebase
                Authentication e seu perfil salvo com segurança pela API do
                Pesk.
              </Text>

              {onAbrirTestes ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.testLinkButton}
                  onPress={onAbrirTestes}
                  activeOpacity={0.8}
                >
                  <Text style={styles.testLinkText}>
                    JÁ TENHO CONTA · TESTAR COMPETIÇÕES
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#071311',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? 24 : 16,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 24,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 3,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E599',
    marginHorizontal: 8,
  },
  badgeClub: {
    backgroundColor: '#122E26',
    borderColor: '#00E599',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeClubText: {
    color: '#00E599',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tagline: {
    color: '#8BA59B',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  configAlert: {
    backgroundColor: '#112229',
    borderColor: '#1D4554',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  configAlertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
    marginTop: 6,
    marginRight: 10,
  },
  configAlertContent: {
    flex: 1,
  },
  configAlertTitle: {
    color: '#BAE6FD',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  configAlertText: {
    color: '#7DD3FC',
    fontSize: 12,
    lineHeight: 17,
  },
  formCard: {
    backgroundColor: '#0F211C',
    borderColor: '#1A3830',
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  formSubtitle: {
    color: '#7F9E92',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 20,
  },
  errorBanner: {
    backgroundColor: '#2A1316',
    borderColor: '#7F1D1D',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  errorIcon: {
    fontSize: 14,
    marginRight: 10,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#D2E3DC',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: '#091613',
    borderColor: '#24453C',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: '#FFFFFF',
    fontSize: 15,
  },
  inputWithAction: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputFlex: {
    paddingRight: 75,
  },
  togglePasswordButton: {
    position: 'absolute',
    right: 14,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  togglePasswordText: {
    color: '#00E599',
    fontSize: 12,
    fontWeight: '700',
  },
  buttonSubmit: {
    backgroundColor: '#00E599',
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#00E599',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonSubmitText: {
    color: '#071311',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    marginLeft: 4,
  },
  footerNotice: {
    color: '#5C7A6F',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 18,
  },
  cardSucesso: {
    backgroundColor: '#0F2620',
    borderColor: '#00E599',
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#00E599',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  sucessoIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#133D31',
    borderColor: '#00E599',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sucessoIcon: {
    color: '#00E599',
    fontSize: 32,
    fontWeight: '900',
  },
  sucessoTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  sucessoSubtitle: {
    color: '#9EBFB3',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  sucessoDetails: {
    width: '100%',
    backgroundColor: '#091A15',
    borderColor: '#1C4035',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  sucessoDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  sucessoDetailLabel: {
    color: '#6F9185',
    fontSize: 13,
    fontWeight: '600',
  },
  sucessoDetailValue: {
    color: '#E2F0EB',
    fontSize: 13,
    fontWeight: '700',
    maxWidth: '70%',
  },
  buttonNovoCadastro: {
    backgroundColor: '#00E599',
    width: '100%',
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonNovoCadastroText: {
    color: '#071311',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  testLinkButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  testLinkText: {
    color: '#00E599',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
