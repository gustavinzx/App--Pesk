import { Stack, useGlobalSearchParams, useLocalSearchParams } from 'expo-router';
import AuthGate from '../../../frontend/components/AuthGate';
import { GroupProvider } from '../../../frontend/context/GroupContext';
import { palette, fonts } from '../../../frontend/theme/brand';
export default function GroupLayout() {
  const local = useLocalSearchParams<{ id: string }>();
  const global = useGlobalSearchParams<{ id?: string }>();
  const id = global.id ?? local.id;
  return <AuthGate><GroupProvider key={id} id={id}><Stack screenOptions={{ headerStyle: { backgroundColor: palette.background }, headerTintColor: palette.text, headerTitleStyle: { fontFamily: fonts.semibold }, contentStyle: { backgroundColor: palette.background }, headerBackTitle: 'Voltar' }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="info" options={{ title: 'Informações do grupo' }} />
    <Stack.Screen name="captura" options={{ title: 'Registrar captura', presentation: 'modal' }} />
  </Stack></GroupProvider></AuthGate>;
}
