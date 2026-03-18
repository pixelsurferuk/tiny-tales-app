import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { View, Image, StyleSheet, Text, ActivityIndicator, Alert, Platform, Share } from "react-native";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import Screen from "../src/components/ui/Screen";
import TTButton from "../src/components/ui/TTButton";
import ShareCaptionBar from "../src/components/ui/ShareCaptionBar";
import { useTTTheme } from "../src/theme";
import { AppBannerAd } from "../src/ads/admob";
import SpeechBubble from "../src/components/ui/SpeechBubble";
import ThoughtBottomBar from "../src/components/ui/ThoughtBottomBar";
import { getThoughtFromServer } from "../src/services/ai";
import { getAccessToken } from "../src/services/auth";
import { makeImageDataUrlPro } from "../src/services/imageDataUrl";
import { getActivePet, summarizePetForPrompt } from "../src/services/pets";
import { pickOfflineThought } from "../src/utils/OfflineThoughts";
import { parseCreditsFromResponse } from "../src/utils/credits";
import { setAndroidNavBarStyle } from "../src/utils/navBar";
import { useEntitlements } from "../src/state/entitlements";
import { CREDIT_ERROR_CODES } from "../src/config";

function pickParamString(v) {
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : null;
    return null;
}

const makeStyles = (t) =>
    StyleSheet.create({
        container: { flex: 1 },
        exportWrap: { flex: 1, flexDirection: "column" },
        imageWrap: { flex: 1 },
        image: { width: "100%", height: "100%", resizeMode: "cover" },
        bubblePos: { position: "absolute", top: 20, left: 20, right: 20, alignItems: "flex-start" },
        mainButtons: { flexDirection: "row", gap: 10 },
        busyRow: {
            position: "absolute",
            left: 10,
            right: 10,
            bottom: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FFFFFF",
            padding: 10,
            borderRadius: 12,
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
        },
        busyText: { fontSize: 16, lineHeight: 22, textAlign: "center", color: "#2E2E2E", fontWeight: "400" },
    });

export default function Preview() {
    const params = useLocalSearchParams();
    const t = useTTTheme();
    const styles = useMemo(() => makeStyles(t), [t]);

    const { deviceId: identityId, isPro, server, refreshAll, setCreditsLocal } = useEntitlements();

    const uri = pickParamString(params?.uri);
    const fromProfiles = pickParamString(params?.src) === "profiles";

    const [thought, setThought] = useState("…");
    const [thinking, setThinking] = useState(false);
    const [thinkingStage, setThinkingStage] = useState("");
    const [checkingAccess, setCheckingAccess] = useState(true);
    const [busy, setBusy] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [showCaption, setShowCaption] = useState(false);
    const [serverOnline, setServerOnline] = useState(true);
    const [adRefresh, setAdRefresh] = useState(0);
    const [activePet, setActivePet] = useState(null);

    const [mediaPerm] = MediaLibrary.usePermissions({ writeOnly: true });
    const cardRef = useRef(null);
    const thinkingRef = useRef(false);
    const autoRequestedRef = useRef(false);
    const proDataUrlRef = useRef(null);

    useEffect(() => { setAndroidNavBarStyle("light"); }, []);

    useEffect(() => {
        proDataUrlRef.current = null;
        autoRequestedRef.current = false;
        setCheckingAccess(true);
        setImageLoaded(false);
    }, [uri]);

    const refreshActivePet = useCallback(async () => {
        try {
            setActivePet(await getActivePet() || null);
        } catch (e) {
            console.warn("[preview] getActivePet failed", e?.message || e);
            setActivePet(null);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            refreshActivePet();
            refreshAll({ reason: "preview_focus", retries: 1, delayMs: 300 });
        }, [refreshActivePet, refreshAll])
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!uri || !identityId) {
                if (!cancelled) setCheckingAccess(false);
                return;
            }
            try {
                setCheckingAccess(true);
                const result = await refreshAll({ reason: "preview_access_check", retries: 1, delayMs: 200 });
                const remaining = result?.status?.creditsRemaining ?? server?.creditsRemaining ?? null;
                if (!cancelled && !isPro && remaining !== null && remaining <= 0) {
                    router.replace({ pathname: "/paywall", params: { source: "thoughts" } });
                }
            } catch (e) {
                console.warn("[preview] access check failed", e?.message || e);
            } finally {
                if (!cancelled) setCheckingAccess(false);
            }
        })();
        return () => { cancelled = true; };
    }, [uri, identityId, isPro, refreshAll]);

    const redirectToPaywall = useCallback((creditPatch) => {
        if (creditPatch) {
            const parsed = parseCreditsFromResponse(creditPatch);
            if (Object.values(parsed).some((v) => typeof v === "number")) {
                setCreditsLocal(parsed);
            }
        }
        router.replace({ pathname: "/paywall", params: { source: "thoughts" } });
    }, [setCreditsLocal]);

    const runSmartThought = useCallback(
        async ({ auto = false } = {}) => {
            if (!uri) return;
            if (!identityId) {
                if (!auto) Alert.alert("Missing identity", "Try again in a second.");
                return;
            }
            if (thinkingRef.current || checkingAccess) return;

            try {
                if (!isPro) {
                    setCheckingAccess(true);
                    let remaining = server?.creditsRemaining ?? null;
                    if (remaining === null) {
                        const result = await refreshAll({ reason: "preview_precheck", retries: 1, delayMs: 250 });
                        remaining = result?.status?.creditsRemaining ?? server?.creditsRemaining ?? null;
                    }
                    if (remaining !== null && remaining <= 0) {
                        redirectToPaywall(null);
                        return;
                    }
                }
            } finally {
                setCheckingAccess(false);
            }

            thinkingRef.current = true;
            setThinking(true);

            try {
                setThinkingStage("Preparing…");
                // Parallelise image processing and auth token fetch
                if (!proDataUrlRef.current) {
                    const [dataUrl] = await Promise.all([
                        makeImageDataUrlPro(uri),
                        getAccessToken().catch(() => null),
                    ]);
                    proDataUrlRef.current = dataUrl;
                }

                setThinkingStage("Thinking…");
                const r = await getThoughtFromServer({
                    imageDataUrl: proDataUrlRef.current,
                    identityId,
                    pet: summarizePetForPrompt(activePet),
                });

                setServerOnline(true);

                if (!r?.ok) {
                    if (CREDIT_ERROR_CODES.has(r?.error)) {
                        redirectToPaywall(r);
                        return;
                    }
                    if(__DEV__) Alert.alert("Thought Error", "Couldn't generate a thought.");
                    return;
                }

                setThinkingStage("Crafting response…");
                setThought(r?.thought || pickOfflineThought());

                const patch = parseCreditsFromResponse(r);
                if (Object.values(patch).some((v) => typeof v === "number")) {
                    setCreditsLocal(patch);
                } else if (!isPro) {
                    await refreshAll({ reason: "smart_thought_spend", retries: 1, delayMs: 250 });
                }

                setAdRefresh((n) => n + 1);
            } catch (e) {
                console.warn("[preview] smart thought error", e?.message, e?.status, e?.data || e);
                const errCode = e?.data?.error;
                if (CREDIT_ERROR_CODES.has(errCode)) {
                    redirectToPaywall(e?.data);
                    return;
                }
                setServerOnline(false);
                setThought(pickOfflineThought());
            } finally {
                thinkingRef.current = false;
                setThinking(false);
                setThinkingStage("");
            }
        },
        [uri, identityId, activePet, isPro, server?.creditsRemaining, refreshAll,
            setCreditsLocal, redirectToPaywall, checkingAccess]
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!uri || !identityId || checkingAccess || autoRequestedRef.current) return;
            autoRequestedRef.current = true;
            if (!cancelled) await runSmartThought({ auto: true });
        })();
        return () => { cancelled = true; };
    }, [uri, identityId, checkingAccess, runSmartThought]);

    async function exportComposite() {
        try {
            setBusy(true);
            if (!cardRef.current) {
                Alert.alert("Export failed", "Preview view not ready yet.");
                return null;
            }
            if (!imageLoaded) {
                Alert.alert("Export failed", "Image is still loading, try again in a moment.");
                return null;
            }
            setShowCaption(true);
            await new Promise((resolve) => setTimeout(resolve, 150));
            const result = await captureRef(cardRef.current, { format: "png", quality: 1, result: "tmpfile" });
            setShowCaption(false);
            return result;
        } catch (e) {
            console.warn(e);
            setShowCaption(false);
            Alert.alert("Export failed", "Couldn't generate the image. Try again.");
            return null;
        } finally {
            setBusy(false);
        }
    }

    async function onShare() {
        const exportedUri = await exportComposite();
        if (!exportedUri) return;
        try {
            if (Platform.OS === "ios") {
                await Share.share({ url: exportedUri });
            } else {
                await Sharing.shareAsync(exportedUri, { mimeType: "image/png", dialogTitle: "Share Tiny Tales" });
            }
        } catch (e) {
            console.warn("Share error:", e);
            Alert.alert("Share failed", "Could not open share options.");
        }
    }

    async function onDownload() {
        const exportedUri = await exportComposite();
        if (!exportedUri) return;
        try {
            setBusy(true);
            if (!mediaPerm?.granted) {
                const res = await MediaLibrary.requestPermissionsAsync(true);
                if (!res.granted) {
                    Alert.alert("Permission needed", "Allow Photos permission to save images.");
                    return;
                }
            }
            await MediaLibrary.saveToLibraryAsync(exportedUri);
            Alert.alert("Saved", "Saved to your gallery.");
        } catch (e) {
            console.warn(e);
            Alert.alert("Save failed", "Couldn't save to gallery.");
        } finally {
            setBusy(false);
        }
    }

    const disableButtons = busy || thinking || checkingAccess;

    return (
        <>
            <StatusBar style={t.isDark ? "light" : "dark"} />
            <Screen style={{ backgroundColor: t.colors.bg }} edges={["top", "bottom"]}>
                <View style={styles.container}>
                    <AppBannerAd enabled={!isPro} refreshKey={`${uri}-${adRefresh}`} />

                    <View ref={cardRef} collapsable={false} style={styles.exportWrap}>
                        <View style={styles.imageWrap}>
                            {uri ? (
                                <Image
                                    source={{ uri }}
                                    style={styles.image}
                                    onLoad={() => setImageLoaded(true)}
                                />
                            ) : (
                                <View style={[styles.image, { backgroundColor: "#111" }]} />
                            )}

                            <View style={styles.bubblePos}>
                                <SpeechBubble text={thought || "…"} />
                            </View>

                            {checkingAccess ? (
                                <View style={styles.busyRow}>
                                    <ActivityIndicator style={{ marginRight: 8 }} />
                                    <Text style={styles.busyText}>Checking credits…</Text>
                                </View>
                            ) : thinking ? (
                                <View style={styles.busyRow}>
                                    <ActivityIndicator style={{ marginRight: 8 }} />
                                    <Text style={styles.busyText}>{thinkingStage || "Thinking..."}</Text>
                                </View>
                            ) : !serverOnline ? (
                                <View style={styles.busyRow}>
                                    <Text style={styles.busyText}>Offline</Text>
                                </View>
                            ) : null}
                        </View>

                        {showCaption && <ShareCaptionBar />}
                    </View>

                    <ThoughtBottomBar
                        disableButtons={disableButtons}
                        backIcon={fromProfiles ? "paw-outline" : "camera-reverse-outline"}
                        backLabel={fromProfiles ? "Profiles" : "Retake"}
                        onHome={() => router.replace("/")}
                        onBack={() => router.back()}
                        onShare={onShare}
                        onDownload={onDownload}
                        topContent={
                            <View style={styles.mainButtons}>
                                <TTButton
                                    title="Refresh"
                                    onPress={() => runSmartThought({ auto: false })}
                                    disabled={disableButtons}
                                    loading={false}
                                    style={{ flex: 1 }}
                                    leftIcon={<Ionicons name="refresh" size={18} color={t.colors.textOverPrimary} />}
                                />
                            </View>
                        }
                    />
                </View>
            </Screen>
        </>
    );
}
