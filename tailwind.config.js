/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/index.html', './public/play.html', './public/shared/*.js', './public/games/**/*.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        board: '0 1px 0 rgba(255,255,255,.06) inset, 0 24px 60px -20px rgba(0,0,0,.65)',
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    logs: false,
    themes: [
      {
        arena: {
          primary: '#6d5dfc',
          'primary-content': '#ffffff',
          secondary: '#2dd4bf',
          accent: '#f5b544',
          neutral: '#1c2033',
          'neutral-content': '#c9cde3',
          'base-100': '#121527',
          'base-200': '#0d101e',
          'base-300': '#090b16',
          'base-content': '#e7e9f6',
          info: '#38bdf8',
          success: '#34d399',
          warning: '#fbbf24',
          error: '#fb7185',
          '--rounded-box': '1rem',
          '--rounded-btn': '0.75rem',
          '--rounded-badge': '0.5rem',
          '--btn-focus-scale': '0.97',
          '--border-btn': '1px',
        },
      },
    ],
  },
};
