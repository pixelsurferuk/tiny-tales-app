import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { View, Image, Text, ActivityIndicator, Platform, Share } from "react-native";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import Screen from "../src/components/ui/Screen";
import TTButton from "../src/components/ui/TTButton";
import ShareCaptionBar from "../src/components/ui/ShareCaptionBar";
import { useTTTheme, useGlobalStyles, makePreviewStyles } from "../src/theme/globalStyles";
import { AppBannerAd } from "../src/ads/admob";
import SpeechBubble from "../src/components/ui/SpeechBubble";
import { getThoughtFromServer } from "../src/services/ai";
import { getAccessToken } from "../src/services/auth";
import { makeImageDataUrlPro } from "../src/services/imageDataUrl";
import { getActivePet, summarizePetForPrompt } from "../src/services/pets";
import { pickOfflineThought } from "../src/utils/OfflineThoughts";
import { parseCreditsFromResponse } from "../src/utils/credits";
import { setAndroidNavBarStyle } from "../src/utils/navBar";
import { useEntitlements } from "../src/state/entitlements";
import { CREDIT_ERROR_CODES } from "../src/config";
import { useTTAlert } from "../src/components/ui/TTAlert";
import { useAdGate } from "../src/ads/useAdGate";
import PetHeader from "../src/components/ui/PetHeader";
import AuthCreditsBar from "../src/components/auth/AuthCreditsBar";

function pickParamString(v) {
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : null;
    return null;
}

export default function Preview() {
    const params = useLocalSearchParams();
    const t = useTTTheme();
    const g = useGlobalStyles(t);
    const styles = useMemo(() => makePreviewStyles(t), [t]);

    const { deviceId: identityId, isPro, server, refreshAll, setCreditsLocal } = useEntitlements();

    const uri = pickParamString(params?.uri);
    const fromProfiles = pickParamString(params?.src) === "profiles";

    const [thought, setThought] = useState("");
    const [thinking, setThinking] = useState(false);
    const [busy, setBusy] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [showCaption, setShowCaption] = useState(false);
    const [serverOnline, setServerOnline] = useState(true);
    const [adRefresh, setAdRefresh] = useState(0);
    const [activePet, setActivePet] = useState(null);

    const [thinkingStep, setThinkingStep] = useState(0);

    const [mediaPerm] = MediaLibrary.usePermissions({ writeOnly: true });

    const cardRef = useRef(null);
    const thinkingRef = useRef(false);
    const autoRequestedRef = useRef(false);
    const proDataUrlRef = useRef(null);
    const justWatchedAdRef = useRef(false);

    const getParam = (p) => Array.isArray(p) ? p[0] : p;
    const from = typeof getParam(params?.from) === "string" ? getParam(params.from) : null;

    const alert = useTTAlert();

    useEffect(() => {
        setAndroidNavBarStyle("light");
    }, []);

    useEffect(() => {
        proDataUrlRef.current = null;
        autoRequestedRef.current = false;
        setImageLoaded(false);
    }, [uri]);

    const refreshActivePet = useCallback(async () => {
        try {
            setActivePet(await getActivePet() || null);
        } catch {
            setActivePet(null);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            refreshActivePet();
            refreshAll({ reason: "preview_focus", retries: 1, delayMs: 300 });
        }, [refreshActivePet, refreshAll])
    );

    const openPaywall = useCallback(() => {
        router.replace({
            pathname: "/paywall",
            params: {
                source: "thoughts",
                from, // 👈 THIS is what was missing
            },
        });
    }, [from]);

    const runSmartThought = useCallback(async ({ auto = false } = {}) => {
        if (!uri || !identityId) return;
        if (thinkingRef.current) return;

        thinkingRef.current = true;
        setThinking(true);

        try {
            let remaining = server?.creditsRemaining ?? null;

            if (!isPro && (remaining === null || remaining <= 0)) {
                const result = await refreshAll({ reason: "precheck", retries: 1, delayMs: 200 });
                remaining = result?.status?.creditsRemaining ?? 0;

                if (remaining <= 0) {
                    if (!justWatchedAdRef.current) {
                        tryWatchAd();
                    }
                    return;
                }
            }

            if (!proDataUrlRef.current) {
                const [dataUrl] = await Promise.all([
                    makeImageDataUrlPro(uri),
                    getAccessToken().catch(() => null),
                ]);
                proDataUrlRef.current = dataUrl;
            }

            const r = await getThoughtFromServer({
                imageDataUrl: proDataUrlRef.current,
                identityId,
                pet: summarizePetForPrompt(activePet),
            });

            if (!r?.ok) {
                if (CREDIT_ERROR_CODES.has(r?.error)) {
                    tryWatchAd();
                    return;
                }
                alert("Thought Error", "Couldn't generate a thought.");
                return;
            }

            setThought(r?.thought || pickOfflineThought());

            const patch = parseCreditsFromResponse(r);
            if (Object.values(patch).some((v) => typeof v === "number")) {
                setCreditsLocal(patch);
            }

            setAdRefresh((n) => n + 1);
            setServerOnline(true);

        } catch (e) {
            setServerOnline(false);
            setThought(pickOfflineThought());
        } finally {
            thinkingRef.current = false;
            setThinking(false);
        }
    }, [uri, identityId, activePet, isPro, server?.creditsRemaining, refreshAll, setCreditsLocal]);

    const { tryWatchAd, isWatchingAd } = useAdGate({
        onCreditsGranted: async () => {
            justWatchedAdRef.current = true;

            await refreshAll({ reason: "post_ad_reward", retries: 1, delayMs: 200 });

            autoRequestedRef.current = false;

            setTimeout(() => {
                runSmartThought({ auto: true });
                justWatchedAdRef.current = false;
            }, 300);
        },
        onLimitReached: openPaywall,
    });

    useEffect(() => {
        if (!uri || !identityId || autoRequestedRef.current) return;
        autoRequestedRef.current = true;
        runSmartThought({ auto: true });
    }, [uri, identityId, runSmartThought]);

    useEffect(() => {
        if (!thinking) {
            setThinkingStep(0);
            return;
        }
        const id = setInterval(() => {
            setThinkingStep((prev) => (prev + 1) % 4);
        }, 350);
        return () => clearInterval(id);
    }, [thinking]);

    async function exportComposite() {
        try {
            setBusy(true);
            if (!cardRef.current || !imageLoaded) return null;

            setShowCaption(true);
            await new Promise((r) => setTimeout(r, 150));

            const result = await captureRef(cardRef.current, {
                format: "png",
                quality: 1,
                result: "tmpfile",
            });

            setShowCaption(false);
            return result;
        } finally {
            setBusy(false);
        }
    }

    async function onShare() {
        const uri = await exportComposite();
        if (!uri) return;

        if (Platform.OS === "ios") {
            await Share.share({ url: uri });
        } else {
            await Sharing.shareAsync(uri);
        }
    }

    async function onDownload() {
        const uri = await exportComposite();
        if (!uri) return;

        if (!mediaPerm?.granted) {
            const res = await MediaLibrary.requestPermissionsAsync(true);
            if (!res.granted) return;
        }

        await MediaLibrary.saveToLibraryAsync(uri);
    }

    const disableButtons = busy || thinking || isWatchingAd;

    return (
        <>
            <StatusBar style={t.isDark ? "light" : "dark"} />
            <Screen style={{ backgroundColor: t.colors.bg }} edges={["top", "bottom"]}>
                <View style={styles.container}>

                    <AppBannerAd enabled={!isPro} refreshKey={`${uri}-${adRefresh}`} />

                    <PetHeader
                        petName={fromProfiles ? activePet?.name : null}
                        avatarUri={uri}
                        onBack={() => router.back()}
                        onShare={onShare}
                        onDownload={onDownload}
                        onAddProfile={
                            !fromProfiles
                                ? () =>
                                    router.push({
                                        pathname: "/profiles/edit",
                                        params: { avatarUri: uri },
                                    })
                                : undefined
                        }
                        disabled={disableButtons}
                    />

                    <AuthCreditsBar compact />

                    <View ref={cardRef} collapsable={false} style={styles.exportWrap}>
                        <View style={styles.imageWrap}>
                            <Image
                                source={{ uri }}
                                style={[g.coverImage, !imageLoaded && { backgroundColor: "#111" }]}
                                onLoad={() => setImageLoaded(true)}
                            />

                            <View style={styles.bubblePos}>
                                <SpeechBubble
                                    text={thinking ? null : thought || ""}
                                    customContent={
                                        thinking ? (
                                            <View style={{ flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }}>
                                                <View style={{ flexDirection: "row", gap: 4 }}>
                                                    {[0, 1, 2].map((i) => (
                                                        <Ionicons
                                                            key={i}
                                                            name="paw"
                                                            size={14}
                                                            color={i < thinkingStep ? "#4cb6ac" : "rgba(0,0,0,0.15)"}
                                                        />
                                                    ))}
                                                </View>
                                            </View>
                                        ) : null
                                    }
                                />
                            </View>

                            {/*{(thinking || isWatchingAd) && (
                                <View style={styles.busyRow}>
                                    <ActivityIndicator style={{ marginRight: 8 }} />
                                    <Text style={styles.busyText}>
                                        {isWatchingAd ? "Loading ad…" : "Thinking…"}
                                    </Text>
                                </View>
                            )}*/}
                        </View>

                        {showCaption && <ShareCaptionBar />}
                    </View>

                    <View style={{ flexDirection: "row", gap: 10, padding: 12 }}>
                        <TTButton
                            title="Refresh"
                            onPress={() => runSmartThought({ auto: false })}
                            disabled={disableButtons}
                            style={{ flex: 1 }}
                            leftIcon={<Ionicons name="refresh" size={18} color={t.colors.textOverPrimary} />}
                        />

                        <TTButton
                            title="Share"
                            variant="secondary"
                            onPress={onShare}
                            disabled={disableButtons}
                            style={{ flex: 1 }}
                            leftIcon={<Ionicons name="share-social-outline" size={18} color={t.colors.textOverSecondary} />}
                        />

                        {!fromProfiles && (
                            <TTButton
                                title="Retake"
                                variant="third"
                                onPress={() => router.back()}
                                disabled={disableButtons}
                                style={{ flex: 1 }}
                                leftIcon={<Ionicons name="camera-outline" size={18} color={t.colors.textOverThird} />}
                            />
                        )}
                    </View>

                </View>
            </Screen>
        </>
    );
}