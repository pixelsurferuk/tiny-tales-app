import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Animated, Easing } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import Screen from "../src/components/ui/Screen";
import { useTTTheme, useGlobalStyles, makeCameraStyles } from "../src/theme/globalStyles";
import { setAndroidNavBarStyle } from "../src/utils/navBar";
import { prewarmImageDataUrl } from "../src/services/imageDataUrl";

export default function CameraScreen() {
    const t = useTTTheme();
    const g = useGlobalStyles(t);
    const styles = useMemo(() => makeCameraStyles(t), [t]);

    const cameraRef = useRef(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState("back");
    const [checking, setChecking] = useState(false);
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => { setAndroidNavBarStyle("light"); }, []);

    useEffect(() => {
        if (permission && !permission.granted) requestPermission();
    }, [permission, requestPermission]);

    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, [pulse]);

    if (!permission) return <View style={g.center}><ActivityIndicator /></View>;

    if (!permission.granted) {
        return (
            <View style={g.center}>
                <Pressable style={[g.button, g.buttonPrimary]} onPress={requestPermission}>
                    <Text style={g.buttonText}>Allow Camera</Text>
                </Pressable>
            </View>
        );
    }

    const takePhoto = async () => {
        if (!cameraRef.current || checking) return;
        setChecking(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
            prewarmImageDataUrl(photo.uri);
            router.push({ pathname: "/preview", params: { uri: photo.uri } });
        } finally {
            setChecking(false);
        }
    };

    const guideScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
    const guideOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0.95] });

    return (
        <>
            <StatusBar style={t.isDark ? "light" : "dark"} />
            <Screen style={{ backgroundColor: "#000" }}>
                <View style={styles.container}>
                    <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />
                    <View style={styles.overlay}>
                        <View style={styles.topBar}>
                            <Pressable
                                onPress={() => router.back()}
                                disabled={checking}
                                style={({ pressed }) => [styles.glassBtn, styles.iconBtn, pressed && { opacity: 0.7 }]}
                            >
                                <Ionicons name="chevron-back" size={24} color="#fff" />
                            </Pressable>

                            <View style={[styles.glassBtn, styles.pill]}>
                                <Ionicons name="sparkles" size={16} color="#fff" />
                                <Text style={styles.pillText}>Find your pet</Text>
                            </View>

                            <Pressable
                                onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
                                disabled={checking}
                                style={({ pressed }) => [styles.glassBtn, styles.iconBtn, pressed && { opacity: 0.7 }]}
                            >
                                <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
                            </Pressable>
                        </View>

                        <Animated.View
                            pointerEvents="none"
                            style={[styles.guide, { opacity: guideOpacity, transform: [{ scale: guideScale }] }]}
                        />

                        <View style={styles.bottomBar}>
                            <Pressable
                                onPress={takePhoto}
                                disabled={checking}
                                style={({ pressed }) => [
                                    styles.captureOuter,
                                    pressed && !checking && { transform: [{ scale: 0.98 }] },
                                ]}
                            >
                                <View style={styles.captureInner}>
                                    {checking ? <ActivityIndicator color="#fff" /> : null}
                                </View>
                            </Pressable>
                            <Text style={styles.hint}>Tap to capture. Your pet is already judging you. 🙂</Text>
                        </View>
                    </View>
                </View>
            </Screen>
        </>
    );
}