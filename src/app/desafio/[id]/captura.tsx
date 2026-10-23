import { useGroup } from '../../../frontend/context/GroupContext';
import CapturaScreen from '../../../frontend/screens/CapturaScreen';
export default function CaptureRoute() { return <CapturaScreen id={useGroup().id} />; }
