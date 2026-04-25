/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0f',
          surface: '#12121a',
          elevated: '#1a1a26',
        },
        accent: {
          primary: '#6c63ff',
          secondary: '#00d4ff',
          success: '#00e676',
          warn: '#ffb300',
          danger: '#ff4757',
        },
        text: {
          primary: '#f0f0ff',
          secondary: '#8888aa',
        },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['IBM Plex Mono', 'monospace'],
        code: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
