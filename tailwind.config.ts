import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1400px',
      },
      fontFamily: {
        rancho: ['Rancho', 'sans-serif'],
      },
      textShadow: {
        'shadow-multiple': '1px 1px 2px rgba(0, 0, 0, 0.3), 0 0 5px rgba(0, 0, 0, 0.1)',
      },
      colors: {
        plot: "#21bbdc",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Add custom colors here
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
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        fadeIn: {
          '0%': { opacity: '0' },  // Use string values
          '100%': { opacity: '1' }// Use string values
        },
        typewriter: {
          '0%': { width: '0' },
          '100%': { width: '100%' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "typewriter": 'typewriter 5s steps(50) 1s infinite forwards, infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
