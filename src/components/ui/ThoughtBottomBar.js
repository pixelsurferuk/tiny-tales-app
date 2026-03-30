import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTTTheme, makeThoughtBottomBarStyles } from "../../theme/globalStyles";

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
            <Text style={styles.topIconLabel} numberOfLines={1}>{label}</Text>
        </Pressable>
    );
}

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
    const styles = useMemo(() => makeThoughtBottomBarStyles(t), [t]);

    return (
        <View style={[styles.controls, style]}>
            {!!topContent && <View style={styles.topSlot}>{topContent}</View>}
            <View style={styles.shareControls}>
                <TopIconButton icon="home-outline"         label="Home"     onPress={onHome}     disabled={disableButtons} styles={styles} iconColor={t.colors.text} />
                <TopIconButton icon={backIcon}             label={backLabel} onPress={onBack}    disabled={disableButtons} styles={styles} iconColor={t.colors.text} />
                <TopIconButton icon="share-social-outline" label="Share"    onPress={onShare}    disabled={disableButtons} styles={styles} iconColor={t.colors.text} />
                <TopIconButton icon="download-outline"     label="Save"     onPress={onDownload} disabled={disableButtons} styles={styles} iconColor={t.colors.text} />
            </View>
        </View>
    );
}