import AuthGate from '../frontend/components/AuthGate';
import DesafiosConcluidosScreen from '../frontend/screens/DesafiosConcluidosScreen';

export default function Route() { return <AuthGate><DesafiosConcluidosScreen /></AuthGate>; }
