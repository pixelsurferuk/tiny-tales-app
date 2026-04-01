// src/components/ui/PetHeader.js
import React from "react";
import { View, Text, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTTTheme, useGlobalStyles } from "../../theme/globalStyles";

export default function PetHeader({
      petName,
      avatarUri,
      onBack,
      onShare,
      onDownload,
      onAddProfile,
      disabled = false,
  }) {
    const t = useTTTheme();
    const g = useGlobalStyles(t);

    return (
        <View style={[g.screenHeader, { paddingTop: 5, paddingBottom: 5, paddingHorizontal: 5 }]}>

            {/* Back button */}
            <Pressable
                onPress={onBack || (() => router.back())}
                style={[g.screenHeaderBtn, {borderWidth: 0}]}
                hitSlop={8}
            >
                <Ionicons name="arrow-back" size={24} color={t.colors.text} />
            </Pressable>

            {/* Pet avatar + name */}
            <Pressable
                style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 15, marginLeft: -10 }}
                onPress={onBack || (() => router.back())}
            >
                {avatarUri ? (
                    <Image
                        source={{ uri: avatarUri }}
                        style={{
                            width: 50,
                            height: 50,
                            borderRadius: 999,
                            backgroundColor: t.colors.cardBG,
                        }}
                    />
                ) : (
                    <View style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: t.colors.cardBG,
                        alignItems: "center",
                        justifyContent: "center",
                    }}>
                        <Ionicons name="paw" size={18} color={t.colors.text} />
                    </View>
                )}
                <Text
                    style={[g.subTitle, { fontSize: 20,  marginTop: 5, flexShrink: 1 }]}
                    numberOfLines={1}
                >
                    {petName || ""}
                </Text>
            </Pressable>

            {/* Action buttons */}
            <View style={{ flexDirection: "row", gap: 4 }}>
                {onAddProfile && (
                    <Pressable
                        onPress={onAddProfile}
                        disabled={disabled}
                        style={[g.screenHeaderBtn, { alignItems: "center" }, disabled && { opacity: 0.4 }]}
                        hitSlop={8}
                    >
                        <Ionicons name="paw-outline" size={22} color={t.colors.text} />
                        <Text style={{ fontSize: 10, color: t.colors.text}}>Add Pet</Text>
                    </Pressable>
                )}
                {onShare && (
                    <Pressable
                        onPress={onShare}
                        disabled={disabled}
                        style={[g.screenHeaderBtn, { alignItems: "center", borderWidth: 0 }, disabled && { opacity: 0.4 }]}
                        hitSlop={8}
                    >
                        <Ionicons name="share-social-outline" size={22} color={t.colors.text} />
                        <Text style={{ fontSize: 10, color: t.colors.text }}>Share</Text>
                    </Pressable>
                )}
                {onDownload && (
                    <Pressable
                        onPress={onDownload}
                        disabled={disabled}
                        style={[g.screenHeaderBtn, { alignItems: "center",borderWidth: 0 }, disabled && { opacity: 0.4 }]}
                        hitSlop={8}
                    >
                        <Ionicons name="download-outline" size={22} color={t.colors.text} />
                        <Text style={{ fontSize: 10, color: t.colors.text }}>Save</Text>
                    </Pressable>
                )}
            </View>

        </View>
    );
}