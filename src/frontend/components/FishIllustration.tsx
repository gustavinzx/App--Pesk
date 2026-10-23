import { StyleSheet, View } from 'react-native';
import { palette } from '../theme/brand';
export default function FishIllustration() {
  return <View accessibilityLabel="Ilustração de peixe" accessibilityRole="image" style={s.scene}>
    <View style={s.bubble} /><View style={[s.bubble, { left: 26, top: 28, width: 8, height: 8 }]} />
    <View style={s.fish}><View style={s.tail} /><View style={s.fin} /><View style={s.body}><View style={s.gill} /><View style={s.eye} /><View style={s.flipper} /></View></View>
  </View>;
}
const s = StyleSheet.create({
  scene: { height: 132, width: '100%', backgroundColor: palette.softBlue, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fish: { width: 128, height: 86, alignItems: 'center', justifyContent: 'center' },
  body: { width: 100, height: 62, borderRadius: 50, backgroundColor: palette.blue, overflow: 'hidden', marginLeft: 22 },
  tail: { position: 'absolute', left: 0, top: 17, width: 0, height: 0, borderTopWidth: 25, borderBottomWidth: 25, borderLeftWidth: 32, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: palette.blue },
  fin: { position: 'absolute', top: 3, left: 54, width: 35, height: 28, backgroundColor: palette.blue, borderTopLeftRadius: 30, borderTopRightRadius: 4 },
  eye: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.lime, position: 'absolute', right: 17, top: 18 },
  gill: { width: 45, height: 64, borderRadius: 30, borderWidth: 2, borderColor: '#EBFFDC55', position: 'absolute', right: 35, top: -2 },
  flipper: { width: 26, height: 15, borderBottomLeftRadius: 20, backgroundColor: '#EBFFDC88', position: 'absolute', left: 32, bottom: 10 },
  bubble: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#274EEB33', left: 20, top: 48 },
});
