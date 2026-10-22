import { Text } from '../components/Typography';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { auth } from '../../backend/config/firebase';
import { type CadastrarUsuarioService } from '../../core/business/CadastrarUsuarioService';
import { AuthButton, AuthFeedback, AuthInput, AuthShell, authStyles } from '../components/AuthUI';
import { useSession } from '../context/SessionContext';
import { makeCadastrarUsuarioService } from '../factories/makeCadastrarUsuarioService';
import { useOperation } from '../hooks/usePesk';

export default function CadastroScreen({ service }: { service?: CadastrarUsuarioService }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const operation = useOperation();
  const { setRegistering } = useSession();
  async function register() {
    await operation.run(async () => {
      setRegistering(true);
      try {
        await (service ?? makeCadastrarUsuarioService()).executar({ nome: name, email, senha: password, confirmacaoSenha: confirmation });
      } catch (error) {
        // O acesso só é liberado após a API concluir o cadastro do perfil.
        if (auth.currentUser) await signOut(auth);
        throw error;
      } finally {
        setRegistering(false);
      }
    });
  }
  return <AuthShell title="Criar conta" subtitle="Sua próxima pescaria começa aqui." busy={operation.pending}>
    <AuthFeedback error={operation.error} />
    <AuthInput label="Nome completo" value={name} onChangeText={setName} disabled={operation.pending} />
    <AuthInput label="E-mail" value={email} onChangeText={setEmail} email disabled={operation.pending} />
    <AuthInput label="Senha" value={password} onChangeText={setPassword} password disabled={operation.pending} />
    <Text style={[authStyles.switchText, { textAlign: 'left', marginBottom: 12, fontSize: 12 }]}>Use pelo menos 6 caracteres.</Text>
    <AuthInput label="Confirmar senha" value={confirmation} onChangeText={setConfirmation} password disabled={operation.pending} onSubmitEditing={() => void register()} />
    <AuthButton title="Criar minha conta" onPress={() => void register()} busy={operation.pending} />
    <Pressable accessibilityRole="button" disabled={operation.pending} onPress={() => router.replace('/login')} style={authStyles.switch}>
      <Text style={authStyles.switchText}>Já tem uma conta? <Text style={authStyles.link}>Entrar</Text></Text>
    </Pressable>
  </AuthShell>;
}
