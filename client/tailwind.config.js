/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1e3a5f',
          light: '#2a4a73',
          dark: '#152d4a',
        },
        status: {
          pending: '#FCD34D',
          approved: '#34D399',
          rejected: '#F87171',
        },
      },
    },
  },
  plugins: [],
};
