/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f0f0f',
        'background-secondary': '#1a1a1a',
        accent: '#10b981',
        'accent-hover': '#34d399',
        text: '#ffffff',
        'text-secondary': '#d1d5db',
        'text-muted': '#6b7280',
        border: '#374151',
      },
      fontSize: {
        'display-large': '3rem',
        'display-medium': '2.25rem',
        'headline': '1.875rem',
        'title': '1.5rem',
        'body-large': '1.125rem',
        'body': '1rem',
        'body-small': '0.875rem',
        'caption': '0.75rem',
      },
      spacing: {
        'xs': '0.25rem',
        'sm': '0.5rem',
        'md': '0.75rem',
        'lg': '1rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        '4xl': '2.5rem',
        '5xl': '3rem',
      },
    },
  },
  plugins: [],
}