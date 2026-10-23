import { Text, TextInput } from './Typography';
import { palette, radii } from '../theme/brand';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from './BrandLogo';
import { StatusBar } from 'expo-status-bar';

export function AuthShell({ title, subtitle, children, busy = false }: { title: string; subtitle: string; children: ReactNode; busy?: boolean }) {
  return <SafeAreaView style={authStyles.safe}>
    <StatusBar style="dark" />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={authStyles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={authStyles.authHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" disabled={busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={authStyles.back}><Feather name="chevron-left" color={palette.text} size={28} /></Pressable>
          <BrandLogo width={100} />
        </View>
        <Text style={authStyles.title}>{title}</Text>
        <Text style={authStyles.subtitle}>{subtitle}</Text>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function AuthInput({ label, value, onChangeText, password = false, email = false, disabled = false, onSubmitEditing }: {
  label: string; value: string; onChangeText: (text: string) => void; password?: boolean; email?: boolean; disabled?: boolean; onSubmitEditing?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  return <View style={authStyles.inputRow}>
    <TextInput accessibilityLabel={label} placeholder={label} placeholderTextColor={palette.muted} value={value} onChangeText={onChangeText}
      editable={!disabled} secureTextEntry={password && !visible} autoCapitalize={email || password ? 'none' : 'words'}
      autoCorrect={!email && !password} keyboardType={email ? 'email-address' : 'default'}
      autoComplete={email ? 'email' : password ? 'off' : 'name'} onSubmitEditing={onSubmitEditing} style={authStyles.input} />
    {password && <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar ' + label.toLowerCase() : 'Mostrar ' + label.toLowerCase()} onPress={() => setVisible(value => !value)} disabled={disabled} style={authStyles.eye}><Feather name={visible ? 'eye-off' : 'eye'} size={20} color={palette.muted} /></Pressable>}
  </View>;
}

export function AuthButton({ title, onPress, secondary = false, busy = false, disabled = false, inverse = false }: { title: string; onPress: () => void; secondary?: boolean; busy?: boolean; disabled?: boolean; inverse?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [authStyles.button, secondary && authStyles.secondary, inverse && { backgroundColor: secondary ? '#365BED' : palette.lime, borderWidth: secondary ? 1 : 0, borderColor: '#6B85EF' }, (pressed || disabled || busy) && { opacity: 0.6 }]}>
    {busy ? <ActivityIndicator color={secondary ? palette.text : palette.lime} /> : <Text style={[authStyles.buttonText, secondary && { color: palette.text }, inverse && { color: secondary ? palette.lime : palette.blue }]}>{title}</Text>}
  </Pressable>;
}
export function AuthFeedback({ error, message }: { error?: string; message?: string }) {
  return <>{error ? <Text accessibilityRole="alert" style={authStyles.error}>{error}</Text> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={authStyles.message}>{message}</Text> : null}</>;
}
export const authStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  authHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  content: { flexGrow: 1, padding: 22, paddingTop: 12, paddingBottom: 36, maxWidth: 520, width: '100%', alignSelf: 'center' },
  back: { width: 44, height: 44, marginLeft: -12, justifyContent: 'center', alignItems: 'center' },
  title: { color: palette.text, fontSize: 34, fontWeight: '700', letterSpacing: -0.8, marginBottom: 12 },
  subtitle: { color: palette.muted, fontSize: 17, lineHeight: 25, marginBottom: 28 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radii.input, marginBottom: 10 },
  input: { flex: 1, minWidth: 0, minHeight: 54, paddingHorizontal: 16, paddingVertical: 14, color: palette.text, fontSize: 16 },
  eye: { minWidth: 48, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 54, paddingHorizontal: 22, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill, backgroundColor: palette.blue, marginTop: 12 },
  secondary: { backgroundColor: palette.surface },
  buttonText: { color: palette.lime, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  switch: { minHeight: 48, marginTop: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  switchText: { color: palette.muted, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  link: { color: palette.blue },
  error: { color: palette.danger, backgroundColor: palette.dangerSurface, padding: 12, borderRadius: radii.input, marginBottom: 14, lineHeight: 21, fontSize: 13 },
  message: { color: palette.blue, backgroundColor: palette.softBlue, padding: 12, borderRadius: radii.input, marginBottom: 14, lineHeight: 21, fontSize: 13 },
});
