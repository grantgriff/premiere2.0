import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Claude-Inspired Dark Theme
        background: {
          DEFAULT: '#1A1A1A',
          secondary: '#2C2C2C',
        },
        foreground: {
          DEFAULT: '#F5F5DC',
          secondary: '#A8A8A8',
        },
        accent: {
          DEFAULT: '#8B7355',
          hover: '#A08563',
        },
        border: '#3A3A3A',
        success: '#4CAF50',
        warning: '#FF9800',
        error: '#F44336',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
