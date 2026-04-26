/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
        },
        accent: {
          primary: '#6c63ff',
          secondary: '#00d4ff',
          success: '#00e676',
          warn: '#ffb300',
          danger: '#ff4757',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
        border: 'var(--border-color)',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['IBM Plex Mono', 'monospace'],
        code: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'glow-pulse': 'glowPulse 2.5s ease-in-out infinite',
        'border-flow': 'borderFlow 4s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-in': 'slideInUp 0.35s ease forwards',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.8', filter: 'brightness(1.4)' },
        },
        borderFlow: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(108, 99, 255, 0.3), 0 0 40px rgba(108, 99, 255, 0.1)',
        'glow-success': '0 0 20px rgba(0, 230, 118, 0.3), 0 0 40px rgba(0, 230, 118, 0.1)',
        'glow-danger': '0 0 20px rgba(255, 71, 87, 0.3)',
        'glow-warn': '0 0 20px rgba(255, 179, 0, 0.3)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.15)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.25)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
