import { Text } from '../components/Typography';
import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { ActionButton, EmptyState, Feedback, Input, Screen, styles } from '../components/PeskUI';
import { api, useOperation, useResource } from '../hooks/usePesk';
import { type EspecieDto } from '../services/PeskApiClient';

const load = () => api.listarEspecies();
export default function EspeciesScreen() {
  const resource = useResource(load);
  const operation = useOperation();
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [query, setQuery] = useState('');
  const items = resource.data?.filter(item => item.nome.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))) ?? [];

  async function create() {
    const ok = await operation.run(async () => {
      const max = Number(weight.replace(',', '.'));
      if (!name.trim()) throw new Error('Informe o nome da espécie.');
      if (!Number.isFinite(max) || max <= 0) throw new Error('Informe um peso de referência maior que zero.');
      await api.criarEspecie({ nome: name.trim(), pesoMaxReferenciaKg: max });
      setName('');
      setWeight('');
    }, 'Espécie cadastrada.');
    if (ok) resource.refresh();
  }

  async function toggle(item: EspecieDto) {
    const ok = await operation.run(async () => {
      await api.atualizarEspecie(item.id, { nome: item.nome, pesoMaxReferenciaKg: item.pesoMaxReferenciaKg, ativa: !item.ativa });
    }, item.ativa ? 'Espécie desativada.' : 'Espécie ativada.');
    if (ok) resource.refresh();
  }

  return <Screen title="Espécies de peixes" subtitle="Consulte e cadastre as espécies disponíveis para registrar suas capturas.">
    <Feedback error={operation.error || resource.error} message={operation.message} loading={operation.pending || resource.loading} />
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Cadastrar espécie</Text>
      <Input label="Nome da espécie" value={name} onChangeText={setName} placeholder="Ex.: Tucunaré" />
      <Input label="Peso máximo de referência (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Ex.: 20" />
      <ActionButton title="CADASTRAR ESPÉCIE" onPress={() => void create()} disabled={operation.pending} />
    </View>
    <Input label="Buscar espécie" value={query} onChangeText={setQuery} placeholder="Nome do peixe" />
    <ActionButton title="ATUALIZAR LISTA" onPress={resource.refresh} disabled={resource.loading} secondary />
    {!resource.loading && !resource.error && items.length === 0 && <EmptyState title="Nenhuma espécie encontrada" description="Cadastre uma espécie ou tente outro nome na busca." />}
    {items.map(item => <View key={item.id} style={styles.listItem}><View style={styles.flex}><Text style={styles.itemTitle}>{item.nome}</Text><Text style={styles.mutedText}>Até {item.pesoMaxReferenciaKg} kg · {item.ativa ? 'Ativa' : 'Inativa'}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel={(item.ativa ? 'Desativar ' : 'Ativar ') + item.nome} disabled={operation.pending} onPress={() => void toggle(item)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={item.ativa ? styles.dangerText : styles.link}>{item.ativa ? 'DESATIVAR' : 'ATIVAR'}</Text></TouchableOpacity></View>)}
  </Screen>;
}
