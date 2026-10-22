import { Image, View } from 'react-native';

const blueOnLime = require('../../../assets/brand/pesk-blue-on-lime.jpeg');
const limeOnBlue = require('../../../assets/brand/pesk-lime-on-blue.jpeg');

// Exibe a faixa central do arquivo original sem redesenhar ou distorcer a marca.
export default function BrandLogo({ width = 132, inverse = false }: { width?: number; inverse?: boolean }) {
  const height = width * 0.42;
  return <View style={{ width, height, overflow: 'hidden' }}>
    <Image accessibilityLabel="Pesk" source={inverse ? limeOnBlue : blueOnLime} resizeMode="contain"
      style={{ position: 'absolute', width, height: width, top: (height - width) / 2 }} />
  </View>;
}
