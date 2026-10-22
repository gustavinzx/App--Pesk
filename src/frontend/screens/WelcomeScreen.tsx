import { Text } from '../components/Typography';
import { palette } from '../theme/brand';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthButton } from '../components/AuthUI';
import BrandLogo from '../components/BrandLogo';

export default function WelcomeScreen() {
  return <SafeAreaView style={s.safe}>
    <StatusBar style="light" />
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.hero}>
        <Text style={s.eyebrow}>PESCAR. COMPARTILHAR. REPETIR.</Text>
        <View style={s.logo}><BrandLogo width={286} inverse /></View>
        <Text style={s.title}>Boas histórias{String.fromCharCode(10)}começam na água.</Text>
        <Text style={s.subtitle}>Reúna a turma, registre suas capturas{String.fromCharCode(10)}e transforme cada pescaria em um desafio.</Text>
      </View>
      <View style={s.bottom}>
        <AuthButton title="Começar · Criar conta" onPress={() => router.push('/cadastro')} inverse />
        <AuthButton title="Já tenho conta · Entrar" onPress={() => router.push('/login')} inverse secondary />
        <Text style={s.footer}>A pescaria fica melhor em grupo.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.blue },
  content: { flexGrow: 1, padding: 22, paddingBottom: 28, width: '100%', maxWidth: 520, alignSelf: 'center' },
  hero: { flex: 1, minHeight: 400, justifyContent: 'center', alignItems: 'center', paddingVertical: 45 },
  eyebrow: { color: palette.lime, fontSize: 10, fontWeight: '600', letterSpacing: 2, textAlign: 'center', marginBottom: 38 },
  logo: { marginBottom: 36 },
  title: { color: palette.lime, fontSize: 29, fontWeight: '700', lineHeight: 39, textAlign: 'center', letterSpacing: -1 },
  subtitle: { color: '#DCE8FF', fontSize: 13, lineHeight: 22, textAlign: 'center', marginTop: 18 },
  bottom: { paddingBottom: 8 },
  footer: { color: '#DCE8FF', fontSize: 11, textAlign: 'center', lineHeight: 19, marginTop: 22 },
});
