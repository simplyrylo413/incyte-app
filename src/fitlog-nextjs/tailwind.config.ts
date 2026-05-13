import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d10",
        panel: "#14181d",
        panel2: "#1a1f25",
        line: "#262d35",
        ink: "#e6ebf1",
        sub: "#8a93a0",
        accent: "#7cdcff",
        good: "#5be39a",
        bad: "#ff7b7b",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
