/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#08111f",
        mist: "#eef6ff",
        ember: "#ff7a18",
        mint: "#18e7b2",
        slateblue: "#5b6cff",
        plasma: "#7c3aed",
        signal: "#8cf3ff",
        night: "#020817"
      },
      boxShadow: {
        panel: "0 32px 90px rgba(3, 7, 18, 0.35)",
        glow: "0 0 0 1px rgba(140,243,255,0.18), 0 0 36px rgba(91,108,255,0.18)",
        neon: "0 20px 80px rgba(124,58,237,0.28)"
      },
      fontFamily: {
        sans: ["'Sora'", "'Space Grotesk'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"]
      },
      backgroundImage: {
        "control-grid":
          "linear-gradient(rgba(140,243,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(140,243,255,0.08) 1px, transparent 1px)",
        "panel-sheen":
          "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 32%, rgba(91,108,255,0.14) 100%)"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" }
        },
        pulseline: {
          "0%, 100%": { opacity: "0.45", transform: "scaleX(0.96)" },
          "50%": { opacity: "1", transform: "scaleX(1)" }
        },
        sweep: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" }
        }
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        pulseline: "pulseline 2.8s ease-in-out infinite",
        sweep: "sweep 6s linear infinite"
      }
    },
  },
  plugins: [],
};
