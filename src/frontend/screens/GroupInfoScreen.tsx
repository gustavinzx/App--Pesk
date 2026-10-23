import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Share, View } from 'react-native';
import { AuthButton } from '../components/AuthUI';
import GroupCover from '../components/GroupCover';
import { ConfirmDialog, GroupBody, GroupRow, InitialAvatar, g, periodLabel } from '../components/GroupUI';
import { Feedback } from '../components/PeskUI';
import { Text } from '../components/Typography';
import { useGroup } from '../context/GroupContext';
import { useGroupDirectory } from '../context/GroupDirectoryContext';
import { api, useOperation, useUsuario } from '../hooks/usePesk';
import { palette } from '../theme/brand';

export default function GroupInfoScreen() {
  const { id, group } = useGroup();
  const directory = useGroupDirectory();
  const user = useUsuario();
  const operation = useOperation();
  const [rules, setRules] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!group) return <GroupBody>{null}</GroupBody>;
  const owner = group.donoId === user?.uid;
  const admin = group.participantes.find(item => item.pescadorId === group.donoId);
  const ended = group.status === 'encerrado' || group.status === 'cancelado';
  const canLeave = !owner && (group.tipo === 'clube' || (group.status === 'aberto' && new Date(group.inicio) > new Date()));
  async function invite() {
    await operation.run(async () => { await Share.share({ message: 'Pesque com a gente no grupo ' + group!.nome + '! No Pesk, escolha Entrar por convite e use o código ' + group!.codigoConvite + '.' }); });
  }
  async function leave() {
    const ok = await operation.run(async () => {
      if (owner) await api.cancelarDesafio(id); else await api.sairGrupo(id);
    });
    if (ok) { setConfirm(false); directory.remove(id); router.replace('/'); }
    else setConfirm(false);
  }
  return <>
    <GroupBody>
      <GroupCover theme={group.capaTema} uri={group.capaUrl} />
      <Text style={[g.title, { textAlign: 'center' }]}>{group.nome}</Text>
      <Text style={[g.muted, { textAlign: 'center', marginBottom: 26 }]}>{periodLabel(group)}</Text>
      {group.descricao ? <Text style={[g.muted, { marginBottom: 24 }]}>{group.descricao}</Text> : null}
      <Feedback error={operation.error} loading={operation.pending} />
      <View style={g.card}><View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><InitialAvatar name={admin?.nomePescador ?? 'Organizador'} /><View><Text style={g.rowTitle}>{admin?.nomePescador ?? 'Organizador'}</Text><Text style={g.muted}>Administrador do grupo</Text></View></View></View>
      <Text style={g.section}>{group.participantes.length} {group.participantes.length === 1 ? 'pescador' : 'pescadores'}</Text>
      <View style={g.card}>{group.participantes.map(item => <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}><InitialAvatar name={item.nomePescador} size={38} /><View style={{ flex: 1 }}><Text style={g.rowTitle}>{item.nomePescador}</Text>{item.pescadorId === group.donoId && <Text style={g.muted}>Administrador</Text>}</View></View>)}</View>
      <View style={g.card}><GroupRow icon="clipboard" title="Regras da pescaria" onPress={() => setRules(true)} /><View style={g.divider} /><GroupRow icon="share" title="Convidar participantes" subtitle="Compartilhar código de convite" onPress={() => void invite()} /><Text selectable style={{ color: palette.blue, fontSize: 19, fontWeight: '700', letterSpacing: 3, marginLeft: 39, marginBottom: 12 }}>{group.codigoConvite}</Text></View>
      {!ended && (owner || canLeave) && <AuthButton title={owner ? 'Encerrar grupo' : 'Sair do grupo'} onPress={() => setConfirm(true)} secondary disabled={operation.pending} />}
      {!owner && !canLeave && !ended && <Text style={g.muted}>A saída de desafios está disponível antes do início da pescaria.</Text>}
    </GroupBody>
    <ConfirmDialog visible={confirm} title={owner ? 'Encerrar este grupo?' : 'Sair deste grupo?'} description={owner ? 'O grupo deixará de aceitar capturas e mensagens. Esta ação não pode ser desfeita.' : 'Você perderá acesso às mensagens e às capturas deste grupo.'} busy={operation.pending} onClose={() => setConfirm(false)} onConfirm={() => void leave()} />
    <Modal visible={rules} transparent animationType="fade" onRequestClose={() => setRules(false)}><View style={g.overlay}><View style={g.dialog} accessibilityViewIsModal><Text style={g.section}>Regras da pescaria</Text><Text style={g.muted}>• Vence a maior captura válida, pelo peso em kg.{String.fromCharCode(10,10)}• Em caso de empate, a captura mais antiga fica à frente.{String.fromCharCode(10,10)}• Cada captura precisa de foto, espécie, peso e local.{String.fromCharCode(10,10)}• Limite de 10 capturas por pescador ao dia.{String.fromCharCode(10,10)}• O peso deve respeitar o máximo de referência da espécie.{String.fromCharCode(10,10)}• Desafios precisam de pelo menos dois participantes no início. Clubes não têm data final.</Text><AuthButton title="Entendi" onPress={() => setRules(false)} /></View></View></Modal>
  </>;
}
