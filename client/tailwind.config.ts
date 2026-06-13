import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#2563EB",
          "blue-light": "#3B82F6",
          "blue-pale": "#EFF6FF",
          navy: "#0F172A",
          "navy-mid": "#1E293B",
          gray: "#F8FAFC",
          "gray-mid": "#E2E8F0",
          "gray-text": "#64748B",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 4px 24px 0 rgba(15,23,42,0.08)",
        card: "0 2px 12px 0 rgba(15,23,42,0.06)",
        modal: "0 8px 40px 0 rgba(15,23,42,0.16)",
      },
      backgroundImage: {
        "hero-blur":
          "url('/hero-bg.jpg')",
      },
    },
  },
  plugins: [],
};
export default config;