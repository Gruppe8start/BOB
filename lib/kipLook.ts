import type { ImageSourcePropType } from 'react-native';
import { KEYS, readJson, writeJson } from './storage';

// Premium: dress Kip up and change his colours. Free users always see the default look.

export type SkinId = 'green' | 'teal' | 'blue' | 'purple' | 'pink' | 'gold';
export type HatId = 'none' | 'gradCap' | 'crown' | 'cap' | 'topHat' | 'party';
export type GlassesId = 'none' | 'sunglasses' | 'glasses';
export type NeckId = 'none' | 'bow' | 'scarf' | 'medal' | 'tie';

export type KipLook = {
  skin: SkinId;
  /** Tile colour behind Kip. */
  background: string;
  hat: HatId;
  glasses: GlassesId;
  neck: NeckId;
};

export const DEFAULT_LOOK: KipLook = { skin: 'green', background: '#2B5A32', hat: 'none', glasses: 'none', neck: 'none' };

export const SKINS: { id: SkinId; label: string; swatch: string; source: ImageSourcePropType }[] = [
  { id: 'green', label: 'Classic', swatch: '#6E9540', source: require('../assets/kip/kip-green.png') },
  { id: 'teal', label: 'Teal', swatch: '#3F9A86', source: require('../assets/kip/kip-teal.png') },
  { id: 'blue', label: 'Blue', swatch: '#3D78A6', source: require('../assets/kip/kip-blue.png') },
  { id: 'purple', label: 'Purple', swatch: '#6A4AA8', source: require('../assets/kip/kip-purple.png') },
  { id: 'pink', label: 'Pink', swatch: '#A8487E', source: require('../assets/kip/kip-pink.png') },
  { id: 'gold', label: 'Gold', swatch: '#A67A2E', source: require('../assets/kip/kip-gold.png') },
];

export const BACKGROUNDS = ['#2B5A32', '#1E3A5F', '#4A2C5E', '#5E2C3A', '#5E4A1E', '#2A2A2A', '#DDE6D5'];

// Outfit pieces are emoji overlays, positioned relative to Kip's head in the artwork.
export const HATS: { id: HatId; label: string; emoji: string }[] = [
  { id: 'none', label: 'None', emoji: '' },
  { id: 'gradCap', label: 'Grad cap', emoji: '🎓' },
  { id: 'crown', label: 'Crown', emoji: '👑' },
  { id: 'cap', label: 'Cap', emoji: '🧢' },
  { id: 'topHat', label: 'Top hat', emoji: '🎩' },
  { id: 'party', label: 'Party', emoji: '🥳' },
];

export const GLASSES: { id: GlassesId; label: string; emoji: string }[] = [
  { id: 'none', label: 'None', emoji: '' },
  { id: 'sunglasses', label: 'Shades', emoji: '🕶️' },
  { id: 'glasses', label: 'Glasses', emoji: '👓' },
];

export const NECKWEAR: { id: NeckId; label: string; emoji: string }[] = [
  { id: 'none', label: 'None', emoji: '' },
  { id: 'bow', label: 'Bow tie', emoji: '🎀' },
  { id: 'scarf', label: 'Scarf', emoji: '🧣' },
  { id: 'medal', label: 'Medal', emoji: '🏅' },
  { id: 'tie', label: 'Tie', emoji: '👔' },
];

export function skinSource(id: SkinId) {
  return (SKINS.find(s => s.id === id) ?? SKINS[0]).source;
}

export function loadLook() {
  return readJson<KipLook>(KEYS.kipLook, DEFAULT_LOOK);
}

export function saveLook(look: KipLook) {
  return writeJson(KEYS.kipLook, look);
}
