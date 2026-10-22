import { Text, TextInput } from './Typography';
import { palette, radii } from '../theme/brand';
import { type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const COLORS = {
  background: palette.background,
  surface: palette.surface,
  surfaceAlt: palette.surface,
  border: palette.border,
  accent: palette.blue,
  text: palette.text,
  muted: palette.muted,
  danger: palette.danger,
};


export function dataLocal(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
  maxLength,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'email-address';
  secureTextEntry?: boolean;
  maxLength?: number;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        maxLength={maxLength}
        multiline={multiline}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

export function ActionButton({
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


export const styles = StyleSheet.create({
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
    borderRadius: radii.card,
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
  label: { color: palette.text, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  input: {
    color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radii.input,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 15,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: radii.pill,
    minHeight: 50,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonSecondary: {
    backgroundColor: palette.softBlue,
    borderColor: palette.border,
    borderWidth: 1,
  },
  buttonText: {
    color: palette.lime,
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
    borderRadius: radii.input,
  },
  signOutText: { color: COLORS.accent, fontSize: 11, fontWeight: '800' },
  mutedText: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  bodyText: { color: palette.text, fontSize: 14, lineHeight: 22, marginBottom: 4 },
  itemTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  hint: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  error: {
    color: COLORS.danger,
    backgroundColor: palette.dangerSurface,
    borderRadius: radii.input,
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
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
    gap: 12,
  },
  listItemSelected: { borderColor: COLORS.accent, backgroundColor: palette.softBlue },
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
    borderRadius: radii.input,
    backgroundColor: COLORS.surfaceAlt,
  },
});



export function Screen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { width: '100%', maxWidth: 680, alignSelf: 'center' }]}>
        <Text style={styles.heading}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : <View style={{ height: 20 }} />}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function Feedback({ error, message, loading }: { error?: string; message?: string; loading?: boolean }) {
  return <>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text> : null}
    {loading ? <ActivityIndicator color={COLORS.accent} style={styles.loader} /> : null}
  </>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.bodyText}>{description}</Text></View>;
}
