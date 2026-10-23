import { useSession } from '../frontend/context/SessionContext';
import HomeScreen from '../frontend/screens/HomeScreen';
import WelcomeScreen from '../frontend/screens/WelcomeScreen';

export default function IndexRoute() {
  return useSession().user ? <HomeScreen /> : <WelcomeScreen />;
}
