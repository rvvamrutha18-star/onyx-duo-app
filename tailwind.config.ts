import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#070d1a', 900: '#0b1426', 800: '#101d36', 700: '#17284a', 600: '#21386a' },
        steel: { 300: '#a9c1db', 400: '#7aa2c8', 500: '#4f7cac' },
      },
    },
  },
  plugins: [],
} satisfies Config;
