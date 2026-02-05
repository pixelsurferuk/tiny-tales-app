// app/camera.js
import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    Platform,
    Animated,
    Easing,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { pingServer } from "../src/services/ai";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

async function setAndroidNavBarDark() {
    if (Platform.OS !== "android") return;

    try {
        const mod = await import("expo-navigation-bar");
        const Nav = mod?.default ?? mod;

        if (!Nav?.setButtonStyleAsync) {
            console.warn("NavigationBar loaded but setButtonStyleAsync is missing.");
            return;
        }

        // ✅ Edge-to-edge friendly: set icon colour only
        await Nav.setButtonStyleAsync("light"); // light icons
    } catch (e) {
        console.warn("NavigationBar not available:", e?.message || e);
    }
}

export default function CameraScreen() {
    const cameraRef = useRef(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState("back");
    const [checking, setChecking] = useState(false);

    // Pulse animation
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        setAndroidNavBarDark();
    }, []);

    useEffect(() => {
        if (!permission) return;
        if (!permission.granted) requestPermission();
    }, [permission]);

    useEffect(() => {
        // Smooth breathing pulse
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 1200,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0,
                    duration: 1200,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );

        anim.start();
        return () => anim.stop();
    }, [pulse]);

    if (!permission) {
        return (
            <View style={styles.center}>
                <ActivityIndicator />
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={styles.center}>
                <Pressable style={styles.btn} onPress={requestPermission}>
                    <Text style={styles.btnText}>Allow Camera</Text>
                </Pressable>
            </View>
        );
    }

    const takePhoto = async () => {
        if (!cameraRef.current || checking) return;

        setChecking(true);
        let online = false;

        try {
            online = await pingServer();
        } catch {
            online = false;
        }

        try {
            const photo = await cameraRef.current.takePictureAsync();
            router.push({
                pathname: "/preview",
                params: { uri: photo.uri, online: online ? "1" : "0" },
            });
        } finally {
            setChecking(false);
        }
    };

    const guideScale = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.03],
    });

    const guideOpacity = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.75, 0.95],
    });

    return (
        <>
            <StatusBar style="light" />
            <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
                <View style={styles.container}>
                    <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />

                    <View style={styles.overlay}>
                        <View style={styles.topBar}>
                            {/* Close */}
                            <Pressable
                                onPress={() => router.back()}
                                disabled={checking}
                                style={({ pressed }) => [
                                    styles.iconBtn,
                                    pressed && !checking && styles.iconBtnPressed,
                                    checking && styles.iconBtnDisabled,
                                ]}
                                hitSlop={10}
                            >
                                <Ionicons name="close-outline" size={26} color="#fff" />
                            </Pressable>

                            {/* Switch camera */}
                            <Pressable
                                onPress={() => setFacing((p) => (p === "back" ? "front" : "back"))}
                                disabled={checking}
                                style={({ pressed }) => [
                                    styles.iconBtn,
                                    pressed && !checking && styles.iconBtnPressed,
                                    checking && styles.iconBtnDisabled,
                                ]}
                                hitSlop={10}
                            >
                                <Ionicons name="sync-outline" size={24} color="#fff" />
                            </Pressable>
                        </View>

                        {/* Center guide + tooltip (true centered) */}
                        <View pointerEvents="none" style={styles.centerLayer}>
                            <View style={styles.centerStack}>
                                {/* Tooltip */}
                                <View style={styles.tooltipWrap}>
                                    <View style={styles.tooltipPill}>
                                        <Text style={styles.tooltipText}>{checking ? "Hold still…" : "Place your pet here"}</Text>
                                    </View>
                                    <View style={styles.tooltipArrow} />
                                </View>

                                {/* Pulsing dashed frame */}
                                <Animated.View
                                    style={[
                                        styles.centerGuide,
                                        {
                                            transform: [{ scale: guideScale }],
                                            opacity: guideOpacity,
                                        },
                                    ]}
                                >
                                    <Ionicons name="paw-outline" size={42} color="rgba(255,255,255,0.7)" />
                                </Animated.View>
                            </View>
                        </View>


                        <View style={styles.bottomBar}>
                            <Pressable
                                onPress={takePhoto}
                                disabled={checking}
                                style={({ pressed }) => [
                                    styles.shutterOuter,
                                    pressed && !checking && styles.shutterOuterPressed,
                                    checking && styles.shutterOuterDisabled,
                                ]}
                                hitSlop={12}
                            >
                                <View style={styles.shutterInner}>
                                    <Ionicons name="camera-outline" size={28} color="#000" />
                                </View>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        </>
    );
}

const GUIDE_W = 250;
const GUIDE_H = 280;

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#000" },
    container: { flex: 1, backgroundColor: "#000" },

    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "space-between",
        paddingTop: 25,
        paddingBottom: 40,
        paddingHorizontal: 25,
    },

    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    iconBtn: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.35)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
    },
    iconBtnPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
    iconBtnDisabled: { opacity: 0.5 },

    // --- Center guide positioning (true center) ---
    centerLayer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
    },

    centerStack: {
        alignItems: "center",
        justifyContent: "center",
    },

// Tooltip positioned relative to the guide
    tooltipWrap: {
        alignItems: "center",
        marginBottom: 14, // sits above the box
    },

    tooltipPill: {
        backgroundColor: "rgba(0,0,0,0.78)",
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 14,
    },

    tooltipText: {
        color: "rgba(255,255,255,0.95)",
        fontWeight: "400",
        fontSize: 13,
    },

    tooltipArrow: {
        marginTop: -1,
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 10,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderTopColor: "rgba(0,0,0,0.78)",
    },

    centerGuide: {
        width: 250,
        height: 280,
        borderRadius: 28,
        borderWidth: 2,
        borderStyle: "dashed",
        borderColor: "rgba(255,255,255,0.55)",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.10)",
        marginBottom: 80
    },


    bottomBar: { alignItems: "center" },

    shutterOuter: {
        width: 84,
        height: 84,
        borderRadius: 42,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 5,
        borderColor: "#fff",
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    shutterOuterPressed: { transform: [{ scale: 0.985 }], opacity: 0.95 },
    shutterOuterDisabled: { opacity: 0.6 },

    shutterInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
    },

    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    btn: { padding: 14, backgroundColor: "#2563eb", borderRadius: 12 },
    btnText: { color: "#fff", fontWeight: "800" },
});
