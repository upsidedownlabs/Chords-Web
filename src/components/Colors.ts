// colors.ts

// Base custom colors as an object for configuration
export const customColors = {
  'custom-1': '#EC6FAA',
  'custom-2': '#CE6FAC',
  'custom-3': '#B47EB7',
  'custom-4': '#9D8DC4',
  'custom-5': '#689AD2',
  'custom-6': '#35A5CC',
  'custom-7': '#30A8B4',
  'custom-8': '#32ABA2',
  'custom-9': '#2EAD8D',
  'custom-10': '#31B068',
  'custom-11': '#6CAB43',
  'custom-12': '#94A135',
  'custom-13': '#B19B31',
  'custom-14': '#CC9136',
  'custom-15': '#F2793B',
  'custom-16': '#F2728B',
};

// Derive an array from the object to preserve order for indexing
export const customColorsArray: string[] = Object.values(customColors);

// --- Color adjustment functions ---
function darkenColor(hex: string, amount: number): string {
  validateInput(hex, amount);
  return adjustColor(hex, -amount); // Negative for darkening
}

function lightenColor(hex: string, amount: number): string {
  validateInput(hex, amount);
  return adjustColor(hex, amount); // Positive for lightening
}

function adjustColor(hex: string, amount: number): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new Error('Invalid hex color');
  }

  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;

  r = Math.min(255, Math.max(0, r + Math.floor(255 * amount)));
  g = Math.min(255, Math.max(0, g + Math.floor(255 * amount)));
  b = Math.min(255, Math.max(0, b + Math.floor(255 * amount)));

  return `#${[r, g, b]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('')}`;
}

function validateInput(hex: string, amount: number): void {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new Error('Invalid hex color format');
  }
  if (amount < 0 || amount > 1) {
    throw new Error('Amount must be between 0 and 1');
  }
}

// Create theme-specific color arrays using the array ordering
export const lightThemeColors = customColorsArray.map(hex => darkenColor(hex, 0.2));
export const darkThemeColors = customColorsArray.map(hex => lightenColor(hex, 0.1));

// Helper function to retrieve a color based on channel index and theme
export function getCustomColor(index: number, theme: 'light' | 'dark'): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('Index must be a non-negative integer');
  }

  const colors = theme === 'dark' ? darkThemeColors : lightThemeColors;
  return colors[index % colors.length];
}


// ColorRGBA class definition for plotting
export class ColorRGBA {
  constructor(
    public r: number,
    public g: number,
    public b: number,
    public a: number
  ) { }
}

const LIGHT_THEME_ALPHA = 0.8;
const DARK_THEME_ALPHA = 1.0;
const DARKEN_FACTOR = 0.5; // Adjust to control darkness for light theme

function hexToRGB(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

export const getLineColor = (channelNumber: number, theme: 'light' | 'dark'): ColorRGBA => {
  if (!Number.isInteger(channelNumber) || channelNumber < 1) {
    throw new Error('Channel number must be a positive integer');
  }

  // Convert 1-indexed channel number to 0-indexed index
  const index = channelNumber - 1;
  const hex = getCustomColor(index, theme);
  let { r, g, b } = hexToRGB(hex);
  const alpha = theme === 'dark' ? DARK_THEME_ALPHA : LIGHT_THEME_ALPHA;

  // Apply darkening factor for light theme
  if (theme === 'light') {
    r *= DARKEN_FACTOR;
    g *= DARKEN_FACTOR;
    b *= DARKEN_FACTOR;
  }

  return new ColorRGBA(r, g, b, alpha);
};

