import { Text } from '../components/Typography';
import { router } from 'expo-router';
import { View } from 'react-native';
import { ActionButton, Screen, styles } from '../components/PeskUI';

const steps = [
  ['1. Reúna sua turma', 'Crie sua conta ou entre no Pesk para acompanhar suas pescarias.'],
  ['2. Crie ou entre em um grupo', 'Escolha Desafio para uma pescaria com início e fim ou Clube para um grupo contínuo. Personalize a capa e compartilhe o código de convite.'],
  ['3. Registre suas capturas', 'Abra os detalhes do grupo, escolha a espécie e informe peso, local e uma foto como prova. O comprimento é opcional.'],
  ['4. Acompanhe os resultados', 'Acompanhe a classificação pela maior captura válida de cada pescador, medida pelo peso em kg. Os desafios encerrados ficam em Desafios concluídos.'],
];

export default function AjudaScreen() {
  return <Screen title="Como podemos ajudar?" subtitle="Tudo o que você precisa para começar sua próxima pescaria.">
    {steps.map(([title, description]) => <View key={title} style={styles.card}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.bodyText}>{description}</Text></View>)}
    <View style={styles.card}><Text style={styles.cardTitle}>Não encontrou uma espécie?</Text><Text style={styles.bodyText}>Abra Espécies de peixes para cadastrar uma espécie e seu peso máximo de referência antes de registrar a captura.</Text></View>
    <ActionButton title="VER ESPÉCIES" onPress={() => router.push('/especies')} secondary />
    <ActionButton title="CRIAR UM GRUPO" onPress={() => router.push('/criar-grupo')} />
  </Screen>;
}
