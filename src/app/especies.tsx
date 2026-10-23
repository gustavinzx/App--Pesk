import AuthGate from '../frontend/components/AuthGate';
import EspeciesScreen from '../frontend/screens/EspeciesScreen';

export default function Route() { return <AuthGate><EspeciesScreen /></AuthGate>; }
