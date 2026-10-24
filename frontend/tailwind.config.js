/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Phong cách DressSense (theo giao diện Figma): xanh olive trầm trên nền kem
        brand: {
          DEFAULT: '#4f5e41',
          dark: '#3c4832',
          light: '#eceee6',
        },
        cream: '#f8f6f1',
        ink: '#272723',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
