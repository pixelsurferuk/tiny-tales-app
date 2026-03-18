// src/theme/index.js
import { useColorScheme } from "react-native";

/**
 * Tiny Tales theme system.
 * - Uses system color scheme by default (light/dark).
 * - Centralizes colors/spacing/radius/typography to eliminate style drift.
 *
 * You can later add a ThemeProvider + user toggle (system/light/dark) without
 * changing call sites: keep useTTTheme() as the single access point.
 */

const base = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 10, md: 16, lg: 24, xl: 32 },
  font: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
    weight: { regular: "400", medium: "600", bold: "700" },
  },
  shadow: {
    card: {
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  },
};

const palettes = {
  dark: {
    mode: "dark",
    colors: {
      bg: "#1e1f27",
      cardBG: "rgba(255,255,255,0.05)",
      text: "#F5F7FF",
      textMuted: "#F5F7FF",
      border: "rgba(255,255,255,0.10)",
      primary: "#4cb6ac",
      textOverPrimary: "#1e1f27",
      secondary: "#9675ce",
      textOverSecondary: "#1e1f27",
      accent: "#f8db46",
      danger: "#EF4444",
      textOverDanger: "#ffffff",
      success: "#51c17b",
      textOverSuccess: "#FFFFFF",
      overlay: "rgba(0,0,0,0.35)",
    },
  },
  light: {
    mode: "light",
    colors: {
      bg: "#eeedf3",
      cardBG: "#FFFFFF",
      text: "#1B1F2A",
      textMuted: "rgba(27,31,42,0.83)",
      border: "rgba(0,0,0,0.09)",
      primary: "#4cb6ac",
      textOverPrimary: "#FFFFFF",
      secondary: "#9675ce",
      textOverSecondary: "#FFFFFF",
      accent: "#f8db46",
      danger: "#EF4444",
      textOverDanger: "#ffffff",
      success: "#51c17b",
      textOverSuccess: "#FFFFFF",
      overlay: "rgba(0,0,0,0.35)",
    },
  },
};

export function useTTTheme() {
  const scheme = useColorScheme();
  const key = scheme === "dark" ? "dark" : "light";
  const pal = palettes[key];
  return {
    ...base,
    ...pal,
    isDark: pal.mode === "dark",
  };
}

export const TTTheme = { base, palettes };
