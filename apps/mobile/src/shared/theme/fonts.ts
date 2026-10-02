import { Platform } from 'react-native';

type Weight = '400' | '500' | '600' | '700';

const outfit: Record<Weight, string> = {
  '400': 'Outfit-Regular',
  '500': 'Outfit-Medium',
  '600': 'Outfit-SemiBold',
  '700': 'Outfit-Bold',
};

type FontFace = {
  fontFamily: string;
  fontWeight: 'normal' | Weight;
};

// Android picks the face from the file name. A numeric weight asks for a different face.
export function font(family: string, weight: Weight): FontFace {
  return {
    fontFamily: family,
    fontWeight: Platform.OS === 'android' ? 'normal' : weight,
  };
}

export function outfitFont(weight: Weight): FontFace {
  return font(outfit[weight], weight);
}
