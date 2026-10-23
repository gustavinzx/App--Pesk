import { Image, StyleSheet, View } from 'react-native';
import { palette, radii } from '../theme/brand';
import BrandLogo from './BrandLogo';

export type CoverTheme = 'azul' | 'lima' | 'rio';
export default function GroupCover({ theme = 'azul', uri, children, flush = false }: { theme?: CoverTheme; uri?: string; children?: React.ReactNode; flush?: boolean }) {
  return <View style={[s.cover, { backgroundColor: theme === 'lima' ? palette.lime : palette.blue }, flush && { marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
    {uri ? <Image source={{ uri }} accessibilityLabel="Capa do grupo" style={StyleSheet.absoluteFill} resizeMode="cover" /> : <>
      <View style={[s.circle, { borderColor: theme === 'lima' ? palette.blue : palette.lime, left: theme === 'rio' ? -150 : -170 }]} />
      <View style={[s.circle, { borderColor: theme === 'lima' ? palette.blue : palette.lime, right: theme === 'rio' ? -150 : -170, top: -90 }]} />
      <BrandLogo width={172} inverse={theme !== 'lima'} />
    </>}
    {children}
  </View>;
}
const s = StyleSheet.create({
  cover: { minHeight: 172, borderRadius: radii.card, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  circle: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 28, opacity: 0.13, top: 30 },
});
