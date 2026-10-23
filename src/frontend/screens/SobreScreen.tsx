import { Text } from '../components/Typography';
import Constants from 'expo-constants';
import BrandLogo from '../components/BrandLogo';
import { View } from 'react-native';
import { Screen, styles } from '../components/PeskUI';

export default function SobreScreen() {
  return <Screen title="Sobre o Pesk" subtitle="A pescaria fica melhor em grupo.">
    <View style={[styles.card, { alignItems: 'center', paddingVertical: 32 }]}>
      <BrandLogo width={250} />
      <Text style={styles.mutedText}>FISHING CLUB</Text>
      <Text style={[styles.bodyText, { textAlign: 'center', marginTop: 24 }]}>Um lugar para reunir amigos, criar desafios e guardar as histórias de cada pescaria.</Text>
    </View>
    <View style={styles.card}><Text style={styles.cardTitle}>Cada captura conta uma história</Text><Text style={styles.bodyText}>Organize desafios com sua turma, registre as capturas com foto e acompanhe os resultados de cada pescaria.</Text></View>
    <Text style={[styles.mutedText, { textAlign: 'center' }]}>Versão {Constants.expoConfig?.version ?? '1.0.0'}</Text>
  </Screen>;
}
