// src/theme/globalStyles.js
import { StyleSheet } from "react-native";

/**
 * Global reusable styles that depend on theme.
 * Use as: const s = useGlobalStyles(theme)
 */
export function useGlobalStyles(t) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.bg,
      padding: t.spacing.lg,
    },
    safe: {
      flex: 1,
      backgroundColor: t.colors.bg,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.bg,
    },
    title: {
      color: t.colors.text,
      fontSize: t.font.xl,
      fontWeight: t.font.weight.bold,
      letterSpacing: 0.2,
    },
    subtitle: {
      color: t.colors.textMuted,
      fontSize: t.font.md,
      lineHeight: 22,
    },
    card: {
      backgroundColor: t.colors.bg,
      borderRadius: t.radius.lg,
      padding: t.spacing.lg,
      borderWidth: 1,
      borderColor: t.colors.border,
      ...t.shadow.card,
    },
    row: { flexDirection: "row", alignItems: "center" },
    spacerSm: { height: t.spacing.sm },
    spacerMd: { height: t.spacing.md },
    spacerLg: { height: t.spacing.lg },
  });
}
