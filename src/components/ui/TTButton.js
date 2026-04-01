import React, { useMemo } from "react";
import { Pressable, Text, ActivityIndicator, View } from "react-native";
import { useTTTheme, makeTTButtonStyles } from "../../theme/globalStyles";

export default function TTButton({
         title,
         onPress,
         variant = "primary",
         disabled = false,
         loading = false,
         style,
         textStyle,
         leftIcon = null,
         rightIcon = null,
         iconTop = null,
     }) {
    const t = useTTTheme();
    const s = useMemo(() => makeTTButtonStyles(t), [t]);

    const isTop = !!iconTop; // 👈 detect mode

    const vStyle =
        variant === "secondary" ? s.secondary :
            variant === "third" ? s.third :
                variant === "success" ? s.success :
                    variant === "danger" ? s.danger :
                        s.primary;

    const vText =
        variant === "secondary" ? s.secondaryText :
            variant === "third" ? s.thirdText :
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

                // 👇 apply special layout automatically
                isTop && {
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                },

                (disabled || loading) && s.disabled,
                pressed && !disabled && !loading && s.pressed,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator />
            ) : isTop ? (
                <>
                    <View style={{ marginBottom: 4 }}>
                        {iconTop}
                    </View>

                    <Text
                        style={[
                            s.textStyle,
                            vText,
                            textStyle,
                            {
                                fontSize: 13,
                                textAlign: "center",
                            },
                        ]}
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                </>
            ) : (
                <>
                    {leftIcon}
                    <Text
                        style={[
                            s.textStyle,
                            vText,
                            textStyle,
                            { fontSize: 16 },
                        ]}
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                    {rightIcon}
                </>
            )}
        </Pressable>
    );
}