/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#06020d',
          card: '#0e071b',
          'card-hover': '#160b29',
          border: 'rgba(139, 92, 246, 0.18)',
          'border-bright': 'rgba(168, 85, 247, 0.4)',
          purple: '#8b5cf6',
          'purple-light': '#a855f7',
          'purple-bright': '#c084fc',
          'purple-glow': '#7c3aed',
          pink: '#ec4899',
          green: '#22c55e',
          red: '#f43f5e',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'subtle-spin': 'subtleSpin 20s linear infinite',
        'shimmer': 'shimmer 2.5s infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-12px) rotate(1.5deg)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: 0.4, transform: 'scale(1)' },
          '50%': { opacity: 0.8, transform: 'scale(1.05)' },
        },
        subtleSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        }
      },
      backgroundImage: {
        'purple-gradient': 'linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #4c1d95 100%)',
        'text-purple-gradient': 'linear-gradient(180deg, #ffffff 0%, #d8b4fe 100%)',
        'card-gradient': 'linear-gradient(180deg, rgba(22, 11, 41, 0.7) 0%, rgba(11, 5, 23, 0.8) 100%)',
        'hero-radial': 'radial-gradient(circle at 50% 30%, rgba(124, 58, 237, 0.25) 0%, rgba(6, 2, 13, 0) 70%)',
      }
    },
  },
  plugins: [],
}
