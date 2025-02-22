export class ColorRGBA {
  constructor(
    public r: number,
    public g: number,
    public b: number,
    public a: number
  ) { }
}

// Define custom colors as an array to guarantee order.
export const customColors = [
  '#EC6FAA', // Channel 1
  '#CE6FAC', // Channel 2
  '#B47EB7', // Channel 3
  '#9D8DC4', // Channel 4
  '#689AD2', // Channel 5
  '#35A5CC', // Channel 6
  '#30A8B4', // Channel 7
  '#32ABA2', // Channel 8
  '#2EAD8D', // Channel 9
  '#31B068', // Channel 10
  '#6CAB43', // Channel 11
  '#94A135', // Channel 12
  '#B19B31', // Channel 13
  '#CC9136', // Channel 14
  '#F2793B', // Channel 15
  '#F2728B', // Channel 16
];

// Color adjustment functions remain unchanged.
function darkenColor(hex: string, amount: number): string {
  validateInput(hex, amount);
  return adjustColor(hex, -amount);
}

function lightenColor(hex: string, amount: number): string {
  validateInput(hex, amount);
  return adjustColor(hex, amount);
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

// Create theme-specific color arrays using the array ordering.
export const lightThemeColors = customColors.map(hex => darkenColor(hex, 0.2));
export const darkThemeColors = customColors.map(hex => lightenColor(hex, 0.1));

export function getCustomColor(index: number, theme: 'light' | 'dark'): string {
  const colors = theme === 'dark' ? darkThemeColors : lightThemeColors;
  return colors[index % colors.length];
}

export const getLineColor = (channelNumber: number, theme: 'light' | 'dark'): ColorRGBA => {
  const index = channelNumber - 1; // Convert 1-indexed to 0-indexed.
  const hex = getCustomColor(index, theme);
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const alpha = theme === "dark" ? 1 : 0.8;
  return new ColorRGBA(r, g, b, alpha);
};
