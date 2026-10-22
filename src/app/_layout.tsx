import { fonts, palette } from '../frontend/theme/brand';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text as NativeText, View } from 'react-native';
import { AppMenuProvider, MenuToggle } from '../frontend/components/AppMenu';
import { SessionProvider, useSession } from '../frontend/context/SessionContext';
import { GroupDirectoryProvider } from '../frontend/context/GroupDirectoryContext';

function Navigation() {
  const { user, loading } = useSession();
  if (loading) return <View style={{ flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Carregando sua sessão" color={palette.blue} /></View>;
  return <GroupDirectoryProvider><AppMenuProvider>
    <Stack screenOptions={{ headerStyle: { backgroundColor: palette.background }, headerTintColor: palette.text, headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 16 }, contentStyle: { backgroundColor: palette.background }, headerBackTitle: 'Voltar', headerLeft: () => <MenuToggle /> }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="cadastro" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(user)}>
        <Stack.Screen name="competicoes" options={{ headerShown: false }} />
        <Stack.Screen name="especies" options={{ title: 'Espécies de peixes' }} />
        <Stack.Screen name="criar-grupo" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="criar-desafio" options={{ headerShown: false }} />
        <Stack.Screen name="entrar-convite" options={{ title: 'Entrar por convite' }} />
        <Stack.Screen name="desafios-concluidos" options={{ title: 'Desafios concluídos' }} />
        <Stack.Screen name="desafio/[id]" dangerouslySingular={(_name, params) => String(params.id)} options={{ headerShown: false }} />
        <Stack.Screen name="ajuda" options={{ title: 'Ajuda' }} />
        <Stack.Screen name="sobre" options={{ title: 'Sobre o Pesk' }} />
      </Stack.Protected>
    </Stack>
  </AppMenuProvider></GroupDirectoryProvider>;
}
export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular: require('@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf'),
    PlusJakartaSans_500Medium: require('@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf'),
    PlusJakartaSans_600SemiBold: require('@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf'),
    PlusJakartaSans_700Bold: require('@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf'),
    PlusJakartaSans_800ExtraBold: require('@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf'),
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: palette.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
    <StatusBar style="dark" />
    {error ? <NativeText accessibilityRole="alert">Não foi possível carregar as fontes. Feche e abra o app para tentar novamente.</NativeText> : <ActivityIndicator accessibilityLabel="Carregando o Pesk" color={palette.blue} />}
  </View>;
  return <SessionProvider><StatusBar style="dark" /><Navigation /></SessionProvider>;
}
