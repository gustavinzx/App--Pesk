import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import { useGroup } from '../../../../frontend/context/GroupContext';
import { GroupHeader } from '../../../../frontend/components/GroupUI';
import { palette, fonts } from '../../../../frontend/theme/brand';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export default function GroupTabs() {
  const insets = useSafeAreaInsets();
  const { id } = useGroup();
  return <Tabs screenOptions={{ header: () => <GroupHeader />, sceneStyle: { backgroundColor: palette.background }, tabBarActiveTintColor: palette.blue, tabBarInactiveTintColor: palette.muted, tabBarStyle: { height: 72 + insets.bottom, paddingTop: 8, paddingBottom: Math.max(8, insets.bottom), backgroundColor: palette.surface, borderTopColor: palette.border }, tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16 }, tabBarHideOnKeyboard: true }}>
    <Tabs.Screen name="index" options={{ href: { pathname: '/desafio/[id]', params: { id } }, title: 'Detalhes', tabBarAccessibilityLabel: 'Detalhes do grupo', tabBarIcon: ({ color, size }) => <Feather name="book-open" color={typeof color === 'string' ? color : palette.blue} size={size} /> }} />
    <Tabs.Screen name="ranking" options={{ href: { pathname: '/desafio/[id]/ranking', params: { id } }, title: 'Ranking', tabBarAccessibilityLabel: 'Ranking do grupo', tabBarIcon: ({ color, size }) => <Feather name="award" color={typeof color === 'string' ? color : palette.blue} size={size} /> }} />
    <Tabs.Screen name="chat" options={{ href: { pathname: '/desafio/[id]/chat', params: { id } }, title: 'Chat', tabBarAccessibilityLabel: 'Chat do grupo', tabBarIcon: ({ color, size }) => <Feather name="message-circle" color={typeof color === 'string' ? color : palette.blue} size={size} /> }} />
  </Tabs>;
}

