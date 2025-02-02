// colors.ts
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

// Function to darken a color
function darkenColor(hex: string, amount: number): string {
  validateInput(hex, amount);
  return adjustColor(hex, -amount); // Negative amount for darkening
}

// Function to lighten a color
function lightenColor(hex: string, amount: number): string {
  validateInput(hex, amount);
  return adjustColor(hex, amount); // Positive amount for lightening
}

// General color adjustment function (darkens or lightens based on amount)
function adjustColor(hex: string, amount: number): string {
  // Validate hex format
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new Error('Invalid hex color');
  }

  // Convert hex to RGB
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;

  // Adjust the color by increasing or decreasing each component
  r = Math.min(255, Math.max(0, r + Math.floor(255 * amount)));
  g = Math.min(255, Math.max(0, g + Math.floor(255 * amount)));
  b = Math.min(255, Math.max(0, b + Math.floor(255 * amount)));

  // Convert RGB back to hex with leading zeros
  return `#${[r, g, b]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('')}`;
}

// Validate input for hex color and amount
function validateInput(hex: string, amount: number): void {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new Error('Invalid hex color format');
  }
  if (amount < 0 || amount > 1) {
    throw new Error('Amount must be between 0 and 1');
  }
}

// Example usage
export const lightThemeColors = Object.values(customColors).map((hex) => {
  // Darken the colors more significantly for the light theme
  return darkenColor(hex, 0.4); // Stronger darkening for light theme (0.3 instead of 0.1)
});

export const darkThemeColors = Object.values(customColors).map((hex) => {
  // Lighten the colors slightly for the dark theme
  return lightenColor(hex, 0.1); // Lightening for dark theme
});
