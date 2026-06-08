import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        ink: {
          DEFAULT: "#0F1635",
          muted: "#5B6478",
          subtle: "#9CA3AF",
        },
        line: "#E5E7EB",
        // Slightly muted so red/green signal meaning without screaming.
        danger: "#C8313A",
        success: "#0F8C66",
        // Zuddl brand
        brand: {
          50: "#F4F1FE",
          100: "#E9E3FD",
          200: "#D2C7FB",
          300: "#B4A2F6",
          400: "#9678EF",
          500: "#7B4FE7",
          600: "#6437D6",
          700: "#5125B0",
          800: "#3F1C8A",
          900: "#2C1463",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
