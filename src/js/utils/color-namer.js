import nearestColor from 'nearest-color';
import { colornames } from 'color-name-list';

// Build the {name: hex} map nearest-color expects
const colorMap = colornames.reduce((acc, { name, hex }) => {
  acc[name] = hex;
  return acc;
}, {});

const nearest = nearestColor.from(colorMap);

/**
 * Given a hex color like "#a855f7", returns the closest human-readable name.
 * e.g. "Amethyst" or "Electric Violet" yuh
 */
export function getColorName(hex) {
  try {
    const result = nearest(hex);
    return result?.name ?? null;
  } catch {
    return null;
  }
}
