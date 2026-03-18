// src/components/ThoughtBottomBar.js
import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTTTheme } from "../../theme";

function TopIconButton({ icon, label, onPress, disabled, styles, iconColor }) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.topIconBtn,
                pressed && !disabled && styles.topIconBtnPressed,
                disabled && styles.topIconBtnDisabled,
            ]}
            hitSlop={10}
        >
            <Ionicons name={icon} size={22} color={iconColor} />
            <Text style={styles.topIconLabel} numberOfLines={1}>
                {label}
            </Text>
        </Pressable>
    );
}

/**
 * Shared bottom bar used on Preview + Ask screens.
 */
export default function ThoughtBottomBar({
                                             topContent = null,
                                             disableButtons = false,
                                             onHome,
                                             onBack,
                                             onShare,
                                             onDownload,
                                             backIcon = "camera-reverse-outline",
                                             backLabel = "Back",
                                             style,
                                         }) {
    const t = useTTTheme();
    const styles = useMemo(() => makeStyles(t), [t]);

    const iconColor = t.colors.text;

    return (
        <View style={[styles.controls, style]}>
            {!!topContent && <View style={styles.topSlot}>{topContent}</View>}

            <View style={styles.shareControls}>
                <TopIconButton icon="home-outline" label="Home" onPress={onHome} disabled={disableButtons} styles={styles} iconColor={iconColor} />
                <TopIconButton icon={backIcon} label={backLabel} onPress={onBack} disabled={disableButtons} styles={styles} iconColor={iconColor} />
                <TopIconButton icon="share-social-outline" label="Share" onPress={onShare} disabled={disableButtons} styles={styles} iconColor={iconColor} />
                <TopIconButton icon="download-outline" label="Save" onPress={onDownload} disabled={disableButtons} styles={styles} iconColor={iconColor} />
            </View>
        </View>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        controls: {
            gap: 10,
            // Use your theme keys:
            backgroundColor: t.colors.bg,
        },

        topSlot: {
            paddingTop: 10,
            paddingHorizontal: 10,
            backgroundColor: t.colors.bg,
        },

        shareControls: {
            flexDirection: "row",
            gap: 10,
            padding: 10,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
            // Give the bar a “panel” feel:
            backgroundColor: t.colors.bg,
        },

        topIconBtn: {
            flex: 1,
            height: 56,
            borderRadius: t.radius?.sm ?? 10,
            backgroundColor: t.isDark ? "rgba(255,255,255,0.08)" : "rgba(11,16,32,0.06)",
            borderWidth: 1,
            borderColor: t.colors.border,
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
        },

        topIconBtnPressed: { transform: [{ scale: 0.99 }], opacity: 0.95 },
        topIconBtnDisabled: { opacity: 0.5 },

        topIconLabel: {
            color: t.colors.textMuted ?? t.colors.text,
            fontWeight: "600",
            fontSize: 11,
        },
    });
