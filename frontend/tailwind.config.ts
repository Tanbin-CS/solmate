import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          900: "#090A0F", // Deep Space Black
          800: "#0D1117", // Slate Panel
          700: "#1A202C", // Lighter Panel
        },
        accent: {
          cyan: "#00F0FF", // Telemetry Cyan
          amber: "#FFB800", // Apollo Warning
          mars: "#FF4C4C",  // Martian Ember
        }
      },
      fontFamily: {
        mono: ['var(--font-jetbrains-mono)'],
        sans: ['var(--font-inter)'],
      },
    },
  },
  plugins: [],
};
export default config;