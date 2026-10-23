import { Redirect, useLocalSearchParams } from 'expo-router';
export default function LegacyGroupsRoute() {
  const { secao, id } = useLocalSearchParams<{ secao?: string; id?: string }>();
  if (id) return <Redirect href={{ pathname: '/desafio/[id]', params: { id } }} />;
  if (secao === 'criar') return <Redirect href="/criar-grupo" />;
  if (secao === 'entrar') return <Redirect href="/entrar-convite" />;
  if (secao === 'especies') return <Redirect href="/especies" />;
  return <Redirect href="/" />;
}
