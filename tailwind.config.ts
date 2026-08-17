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
          bg: '#0B0D10',
          surface: '#14171B',
          raised: '#1A1E23',
          border: '#22262C',
          text: '#E8EAED',
          body: '#C7CBD1',
          dim: '#8B929C',
          mute: '#4E545C',
          accent: '#4FD1C5',
          success: '#4FAE7B',
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
