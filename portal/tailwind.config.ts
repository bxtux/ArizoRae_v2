import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0e0a09', 2: '#170f0c', 3: '#1f1512' },
        primary: '#e85520',
        gold: '#f5a520',
        text: '#f0ece8',
        muted: '#8a7d77',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
