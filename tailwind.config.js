/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 500: '#059669', 600: '#047857', 700: '#065f46' }
      }
    },
  },
  plugins: [],
}
