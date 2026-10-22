import { useProfile } from '../context/ProfileContext';
import BrandLogo from './BrandLogo';
import { Text } from './Typography';
import { palette, radii } from '../theme/brand';
import Feather from '@expo/vector-icons/Feather';
import { router, usePathname, type Href } from 'expo-router';
import { signOut } from 'firebase/auth';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useGroupDirectory } from '../context/GroupDirectoryContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../backend/config/firebase';
import { useOperation, useUsuario } from '../hooks/usePesk';

const MenuContext = createContext<(() => void) | null>(null);
export function useAppMenu() {
  const open = useContext(MenuContext);
  if (!open) throw new Error('O menu precisa estar dentro de AppMenuProvider.');
  return open;
}
export function MenuToggle() {
  const open = useAppMenu();
  const user = useUsuario();
  if (!user) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu" onPress={open} style={s.toggle}><Feather name="menu" size={24} color={palette.text} /></Pressable>;
}

type Item = { icon: React.ComponentProps<typeof Feather>['name']; title: string; href: Href };
const groups: Item[][] = [
  [{ icon: 'plus-circle', title: 'Registrar pesca', href: '/registrar-pesca' }, { icon: 'home', title: 'Início', href: '/' }, { icon: 'compass', title: 'Samburá', href: '/especies' }],
  [{ icon: 'plus-circle', title: 'Criar grupo', href: '/criar-grupo' }, { icon: 'users', title: 'Entrar por convite', href: '/entrar-convite' }, { icon: 'flag', title: 'Desafios concluídos', href: '/desafios-concluidos' }],
  [{ icon: 'help-circle', title: 'Ajuda', href: '/ajuda' }, { icon: 'info', title: 'Sobre o Pesk', href: '/sobre' }],
];

export function AppMenuProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const user = useUsuario();
  const directory = useGroupDirectory();
  const path = usePathname();
  const operation = useOperation();
  const { profile } = useProfile();
  const photo = profile?.fotoUrl || user?.photoURL;
  const name = profile?.nome || user?.displayName || user?.email?.split('@')[0] || 'Pescador';
  function navigate(href: Href) {
    setVisible(false);
    if (href === '/registrar-pesca') router.push({ pathname: '/registrar-pesca', params: { returnTo: path === '/registrar-pesca' ? '/' : path } });
    else router.replace(href);
  }
  async function logout() {
    const ok = await operation.run(() => signOut(auth));
    if (ok) { setVisible(false); router.replace('/'); }
  }

  return <MenuContext.Provider value={() => { if (user) { directory.refresh(); setVisible(true); } }}>
    {children}
    <Modal visible={visible && Boolean(user)} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={s.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar menu" onPress={() => setVisible(false)} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={s.drawer} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            <View style={s.profile}>
              {photo ? <Image source={{ uri: photo }} style={s.avatar} /> : <View style={s.avatar}><Text style={s.initial}>{name.charAt(0).toUpperCase()}</Text></View>}
              <View style={{ flex: 1 }}><Text style={s.name}>{name}</Text><Text numberOfLines={2} style={s.email}>{user?.email || 'Bem-vindo ao Pesk'}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar menu" onPress={() => setVisible(false)} style={s.toggle}><Feather name="x" size={23} color={palette.text} /></Pressable>
            </View>
            <View style={s.group}>
              {directory.groups.filter(item => item.status !== 'cancelado').map(item => {
                const selected = path === '/desafio/' + item.id || path.startsWith('/desafio/' + item.id + '/');
                return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Abrir grupo ' + item.nome} accessibilityState={{ selected }} onPress={() => navigate({ pathname: '/desafio/[id]', params: { id: item.id } })} style={({ pressed }) => [s.row, selected && s.active, pressed && { opacity: 0.6 }]}>
                  {item.capaUrl ? <Image source={{ uri: item.capaUrl }} style={{ width: 30, height: 30, borderRadius: 15 }} /> : <View style={{ width: 30, height: 30, borderRadius: 15, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: item.capaTema === 'lima' ? palette.lime : palette.blue }}><BrandLogo width={28} inverse={item.capaTema !== 'lima'} /></View>}
                  <View style={{ flex: 1 }}><Text numberOfLines={2} style={[s.label, selected && { color: palette.blue }]}>{item.nome}</Text><Text style={s.email}>{item.status === 'encerrado' ? 'Concluído' : item.tipo === 'clube' ? 'Clube' : 'Desafio'}</Text></View>
                </Pressable>;
              })}
              {!directory.loading && !directory.error && directory.groups.filter(item => item.status !== 'cancelado').length === 0 && <Text style={s.email}>Crie um grupo ou entre por convite para reunir sua turma aqui.</Text>}
              {directory.error ? <><Text accessibilityRole="alert" style={s.error}>{directory.error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Recarregar grupos" onPress={directory.refresh} style={s.toggle}><Feather name="refresh-cw" size={20} color={palette.blue} /></Pressable></> : null}
            </View>
            {groups.map((items, index) => <View key={index} style={s.group}>{items.map(item => <Pressable key={String(item.href)} accessibilityRole="button" accessibilityLabel={item.title} accessibilityState={{ selected: path === item.href }} onPress={() => navigate(item.href)} style={({ pressed }) => [s.row, path === item.href && s.active, pressed && { opacity: 0.6 }]}><Feather name={item.icon} size={25} color={path === item.href ? palette.blue : palette.text} /><Text style={[s.label, path === item.href && { color: palette.blue }]}>{item.title}</Text></Pressable>)}</View>)}
            {operation.error ? <Text accessibilityRole="alert" style={s.error}>{operation.error}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={user ? 'Sair da conta' : 'Entrar na conta'} disabled={operation.pending} onPress={() => user ? void logout() : navigate('/login')} style={s.row}><Feather name={user ? 'log-out' : 'log-in'} size={25} color={palette.text} /><Text style={s.label}>{operation.pending ? 'Saindo...' : user ? 'Sair da conta' : 'Entrar na conta'}</Text></Pressable>
            <View style={{ marginTop: 28, alignItems: 'flex-start' }}><BrandLogo width={104} /></View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  </MenuContext.Provider>;
}
const s = StyleSheet.create({
  toggle: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: '#0008', flexDirection: 'row' },
  drawer: { width: '87%', maxWidth: 390, backgroundColor: palette.background, height: '100%' },
  content: { paddingHorizontal: 22, paddingBottom: 30 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 26 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: palette.softBlue, alignItems: 'center', justifyContent: 'center' },
  initial: { color: palette.blue, fontSize: 24, fontWeight: '700' },
  name: { color: palette.text, fontSize: 21, fontWeight: '700', marginBottom: 5 },
  email: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  group: { borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 20, minHeight: 57, paddingVertical: 12, paddingHorizontal: 8, borderRadius: radii.input },
  active: { backgroundColor: palette.softBlue },
  label: { color: palette.text, fontSize: 17, flexShrink: 1 },
  footer: { color: palette.muted, letterSpacing: 2, fontSize: 10, marginTop: 32 },
  error: { color: palette.danger, fontSize: 13, lineHeight: 20 },
});
