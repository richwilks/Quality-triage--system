import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#F8FAFC',
          ink: '#1E293B',
          primary: '#2A6F77',
          primaryDark: '#1F565C',
        },
        status: {
          draft: '#94A3B8',
          confirmed: '#3B82F6',
          assigned: '#D97706',
          closed: '#15803D',
          rejected: '#B91C1C',
        },
        deck: {
          bg: '#F5F3EE',
          surface: '#FFFFFF',
          raised: '#ECE9E1',
          border: '#DCD8CE',
          text: '#24221D',
          body: '#4A473F',
          dim: '#767162',
          mute: '#9C9686',
          accent: 'var(--deck-accent-color, #2A6F77)',
          success: '#1E7A46',
        },
        fmiq: {
          accent: 'var(--fmiq-accent-color, #B45309)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
