import { createContext, useContext } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps, type TextStyle } from 'react-native';
import { fonts } from '../theme/brand';

const WeightContext = createContext<TextStyle['fontWeight']>('400');

export function Text({ style, children, ...props }: TextProps) {
  const inheritedWeight = useContext(WeightContext);
  const flat = StyleSheet.flatten(style);
  const weight = flat?.fontWeight ?? inheritedWeight ?? '400';
  const value = weight === 'bold' ? 700 : weight === 'normal' ? 400 : Number(weight);
  const fontFamily = value >= 800 ? fonts.extrabold : value >= 700 ? fonts.bold : value >= 600 ? fonts.semibold : value >= 500 ? fonts.medium : fonts.regular;
  return <WeightContext.Provider value={weight}><NativeText {...props} style={[style, { fontFamily, fontWeight: 'normal' }]}>{children}</NativeText></WeightContext.Provider>;
}

export function TextInput({ style, ...props }: TextInputProps) {
  return <NativeTextInput {...props} style={[{ fontFamily: fonts.regular }, style]} />;
}
