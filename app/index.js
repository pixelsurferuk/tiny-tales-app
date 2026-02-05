// app/index.js
import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

async function setAndroidNavBarLight() {
    if (Platform.OS !== "android") return;

    try {
        const mod = await import("expo-navigation-bar");
        const Nav = mod?.default ?? mod;

        if (!Nav?.setButtonStyleAsync) return;

        await Nav.setButtonStyleAsync("dark"); // dark icons
    } catch (e) {
        console.warn("NavigationBar not available:", e?.message || e);
    }
}

export default function HomeScreen() {
    useEffect(() => {
        setAndroidNavBarLight();
    }, []);

    return (
        <>
            <StatusBar style="dark" />
            <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
                <View style={styles.container}>
                    <Text style={styles.title}>Tiny Tales</Text>
                    <Text style={styles.subtitle}>
                        Point your camera at your pet and reveal what they’re really thinking.
                    </Text>

                    <Pressable style={styles.primaryBtn} onPress={() => router.push("/camera")}>
                        <Text style={styles.primaryBtnText}>Open Camera</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#fff" },
    container: { flex: 1, padding: 24, justifyContent: "center" },

    title: { color: "#111", fontSize: 34, fontWeight: "800", marginBottom: 10 },
    subtitle: { color: "rgba(0,0,0,0.65)", fontSize: 16, marginBottom: 24 },

    primaryBtn: {
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: "#2563eb",
        alignItems: "center",
    },
    primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
