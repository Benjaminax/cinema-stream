/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          950: '#0a0a0a',
        },
        netflix: {
          red: '#e50914',
          'red-dark': '#b20710',
          'red-light': '#f40612',
          black: '#141414',
          'black-light': '#1f1f1f',
          'gray-dark': '#2f2f2f',
        },
      },
      fontFamily: {
        sans: ['Netflix Sans', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}