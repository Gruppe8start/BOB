import { Image, type ImageStyle, type StyleProp } from 'react-native';

type Props = {
  size: number;
  style?: StyleProp<ImageStyle>;
};

/** Kip's face: the reference artwork on its green tile, with rounded corners. */
export default function BobAvatar({ size, style }: Props) {
  return (
    <Image
      source={require('../assets/bob.png')}
      style={[{ width: size, height: size, borderRadius: size * 0.22 }, style]}
      accessibilityLabel="Kip the frog"
    />
  );
}
