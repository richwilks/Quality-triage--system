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
      },
    },
  },
  plugins: [],
}

export default config
