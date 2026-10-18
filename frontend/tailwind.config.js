/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        chili: {
          50: "#fff1f0",
          100: "#ffe0dc",
          500: "#e23b2e",
          600: "#c42a20",
          700: "#9e1f17",
        },
      },
    },
  },
  plugins: [],
};
