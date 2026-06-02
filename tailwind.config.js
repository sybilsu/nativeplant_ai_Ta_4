/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', '"Noto Serif TC"', "Georgia", "serif"],
        body: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"Inter"',
          '"Noto Sans TC"',
          "system-ui",
          "sans-serif",
        ],
        latin: ['"Playfair Display"', "Georgia", "serif"],
      },
      borderRadius: {
        sheet: "28px",
        card: "20px",
        chip: "14px",
        input: "12px",
      },
      colors: {
        evergreen: "#2A5D3F",
        petal: "#B85A6B",
        honey: "#C8A04D",
      },
      transitionTimingFunction: {
        glass: "cubic-bezier(0.25, 0.1, 0.25, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};
