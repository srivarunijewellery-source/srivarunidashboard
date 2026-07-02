import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        sv: {
          purple: {
            DEFAULT: '#3b0764',
            mid: '#6d28d9',
            light: '#7c3aed',
            pale: '#ede9ff',
            faint: '#f5f0ff',
          },
          beige: {
            DEFAULT: '#f5f0e8',
            dark: '#e8d5b7',
            mid: '#f0e8d8',
          },
          ink: '#1a0a2e',
          muted: '#6b5b7b',
        },
      },
      fontFamily: {
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 8px rgba(59,7,100,0.08)',
        'card-hover': '0 8px 32px rgba(59,7,100,0.16)',
        gem: '0 0 0 1px rgba(124,58,237,0.12), 0 4px 16px rgba(59,7,100,0.12)',
      },
      backgroundImage: {
        'sv-gradient': 'linear-gradient(135deg, #3b0764 0%, #6d28d9 100%)',
        'beige-gradient': 'linear-gradient(180deg, #f5f0e8 0%, #f0e8d8 100%)',
      },
    },
  },
  plugins: [],
}

export default config
