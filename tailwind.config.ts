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
          bg: '#1A1D23',
          surface: '#242830',
          raised: '#2D323C',
          border: '#3A3F4A',
          text: '#F1F3F5',
          body: '#D5D9DE',
          dim: '#9BA3AF',
          mute: '#6B7280',
          accent: '#4FD1C5',
          success: '#4FAE7B',
        },
        fmiq: {
          accent: '#F5A623',
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
