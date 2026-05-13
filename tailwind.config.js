/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '375px',
      },
      colors: {
        bg: {
          primary: '#0a0a0a',
          secondary: '#111111',
          tertiary: '#1a1a1a',
          card: '#141414',
          hover: '#1e1e1e',
        },
        border: {
          DEFAULT: '#1e1e1e',
          bright: '#2a2a2a',
          active: '#333333',
        },
        text: {
          primary: '#e6e6e6',
          secondary: '#888888',
          muted: '#555555',
          dim: '#333333',
        },
        accent: {
          cyan: '#00d4ff',
          green: '#00ff88',
          red: '#ff3355',
          yellow: '#ffcc00',
          orange: '#ff8c00',
          purple: '#8b5cf6',
        },
        score: {
          safe: '#00ff88',
          watch: '#ffcc00',
          risk: '#ff3355',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'monospace'],
        mono: ['Space Mono', 'monospace'],
        sans: ['Space Mono', 'monospace'],
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-top': 'env(safe-area-inset-top, 0px)',
      },
      animation: {
        'pulse-green': 'pulseGreen 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        pulseGreen: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(100%)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
    },
  },
  plugins: [],
}
