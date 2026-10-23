import { Text } from '../components/Typography';
import { router } from 'expo-router';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { auth } from '../../backend/config/firebase';
import { AuthButton, AuthFeedback, AuthInput, AuthShell, authStyles } from '../components/AuthUI';
import { useOperation } from '../hooks/usePesk';

function authError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return new Error('E-mail ou senha incorretos. Tente novamente.');
  if (code === 'auth/invalid-email') return new Error('Informe um e-mail válido.');
  if (code === 'auth/too-many-requests') return new Error('Muitas tentativas. Aguarde um pouco e tente novamente.');
  if (code === 'auth/network-request-failed') return new Error('Não foi possível conectar. Confira sua conexão e tente novamente.');
  return new Error('Não foi possível concluir. Tente novamente em instantes.');
}
export default function LoginScreen({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const operation = useOperation();
  async function login() {
    const ok = await operation.run(async () => {
      if (!email.trim() || !password) throw new Error('Informe seu e-mail e sua senha.');
      try { await signInWithEmailAndPassword(auth, email.trim(), password); }
      catch (error) { throw authError(error); }
    });
    if (ok) onSuccess?.();
  }
  async function resetPassword() {
    await operation.run(async () => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Preencha seu e-mail acima para recuperar a senha.');
      try { await sendPasswordResetEmail(auth, email.trim()); }
      catch (error) {
        if ((error as { code?: string })?.code !== 'auth/user-not-found') throw authError(error);
      }
    }, 'Se houver uma conta com esse e-mail, você receberá as instruções para redefinir sua senha. Confira também o spam.');
  }
  return <AuthShell title="Entrar" subtitle="Bem-vindo de volta." busy={operation.pending}>
    <AuthFeedback error={operation.error} message={operation.message} />
    <AuthInput label="E-mail" value={email} onChangeText={setEmail} email disabled={operation.pending} />
    <AuthInput label="Senha" value={password} onChangeText={setPassword} password disabled={operation.pending} onSubmitEditing={() => void login()} />
    <AuthButton title="Entrar" onPress={() => void login()} busy={operation.pending} />
    <AuthButton title="Redefinir minha senha" onPress={() => void resetPassword()} secondary disabled={operation.pending} />
    <Pressable accessibilityRole="button" disabled={operation.pending} onPress={() => router.replace('/cadastro')} style={authStyles.switch}>
      <Text style={authStyles.switchText}>Ainda não tem conta? <Text style={authStyles.link}>Cadastre-se</Text></Text>
    </Pressable>
  </AuthShell>;
}
