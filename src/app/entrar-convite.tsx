import AuthGate from '../frontend/components/AuthGate';
import EntrarConviteScreen from '../frontend/screens/EntrarConviteScreen';

export default function Route() { return <AuthGate><EntrarConviteScreen /></AuthGate>; }
