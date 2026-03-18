// src/components/ui/TTButton.js
import React from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useTTTheme } from "../../theme";

export default function TTButton({
  title,
  onPress,
  variant = "primary", // primary | secondary | danger
  disabled = false,
  loading = false,
  style,
  textStyle,
  leftIcon = null,
  rightIcon = null,
}) {
  const t = useTTTheme();
  const s = styles(t);

  const vStyle =
    variant === "secondary" ? s.secondary :
    variant === "success" ? s.success :
    variant === "danger" ? s.danger :
    s.primary;

  const vText =
    variant === "secondary" ? s.secondaryText :
    variant === "success" ? s.successText :
    variant === "danger" ? s.dangerText :
    s.primaryText;

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.base,
        vStyle,
        (disabled || loading) && s.disabled,
        pressed && !disabled && !loading && s.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <>
          {leftIcon}
          <Text style={[s.text, vText, textStyle]} numberOfLines={1}>
            {title}
          </Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}

const styles = (t) =>
  StyleSheet.create({
    base: {
      minHeight: 44,
      paddingHorizontal: t.spacing.xl,
      borderRadius: t.radius.sm,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
    },
    pressed: {
      transform: [{ scale: 0.99 }],
      opacity: 0.95,
    },
    disabled: {
      opacity: 0.55,
    },
    primary: {
      backgroundColor: t.colors.primary,
    },
    primaryText: {
      color: t.colors.textOverPrimary,
    },
    secondary: {
      backgroundColor: t.colors.secondary,
    },
    secondaryText: {
        color: t.colors.textOverSecondary,
    },
    success: {
      backgroundColor: t.colors.success,
    },
    successText: {
      color: t.colors.textOverSuccess,
    },
    danger: {
      backgroundColor: t.colors.danger,
    },
    dangerText: {
      color: t.colors.textOverDanger,
    },
    text: {
      fontSize: t.font.md,
      fontWeight: t.font.weight.bold,
      letterSpacing: 0.2,
    },
  });
