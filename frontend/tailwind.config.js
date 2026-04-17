/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#edf2f7",
        ember: "#f97316",
        mint: "#14b8a6",
        slateblue: "#3658c9"
      },
      boxShadow: {
        panel: "0 30px 80px rgba(15, 23, 42, 0.16)"
      },
      fontFamily: {
        sans: ["'Space Grotesk'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"]
      }
    },
  },
  plugins: [],
};

