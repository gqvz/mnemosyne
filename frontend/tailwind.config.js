/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0d1117',
        surface: '#161b22',
        border: '#21262d',
        observation: '#3fb950',
        decision: '#58a6ff',
        artifact: '#f78166',
        reflection: '#d2a8ff',
        accent: '#388bfd',
        muted: '#6e7681'
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
