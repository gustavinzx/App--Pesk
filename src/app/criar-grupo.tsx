import AuthGate from '../frontend/components/AuthGate';
import CriarGrupoScreen from '../frontend/screens/CriarGrupoScreen';

export default function CriarGrupoRoute() {
  return <AuthGate><CriarGrupoScreen /></AuthGate>;
}
