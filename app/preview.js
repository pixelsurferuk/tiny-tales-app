// app/preview.js
import React, {useEffect, useRef, useState, useCallback} from "react";
import {useLocalSearchParams, router, useFocusEffect} from "expo-router";
import {View, Image, StyleSheet, Pressable, Text, ActivityIndicator, Alert, Platform} from "react-native";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import {captureRef} from "react-native-view-shot";
import * as SecureStore from "expo-secure-store";
import {devAddProCredits} from "../src/services/credits";
import {PreviewBannerAd} from "../src/ads/admob";
import SpeechBubble from "../src/components/SpeechBubble";
import {classifyImage, getThought, getProThought, getStatus, pingServer} from "../src/services/ai";
import {pickOfflineThought} from "../src/utils/OfflineThoughts";
import {SafeAreaView} from "react-native-safe-area-context";
import {StatusBar} from "expo-status-bar";
import {Ionicons} from "@expo/vector-icons";

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

// ✅ Stable device id
async function getOrCreateDeviceId() {
    const KEY = "tiny_tales_device_id";

    // 👇 DEV: force stable id
    const forced = "dev_jamie";
    await SecureStore.setItemAsync(KEY, forced);
    return forced;

    // Production version:
    // const existing = await SecureStore.getItemAsync(KEY);
    // if (existing) return existing;
    // const fresh = `tt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    // await SecureStore.setItemAsync(KEY, fresh);
    // return fresh;
}

function TopIconButton({icon, label, onPress, disabled}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({pressed}) => [
                styles.topIconBtn,
                pressed && !disabled && styles.topIconBtnPressed,
                disabled && styles.topIconBtnDisabled,
            ]}
            hitSlop={10}
        >
            <Ionicons name={icon} size={22} color="#fff"/>
            <Text style={styles.topIconLabel} numberOfLines={1}>
                {label}
            </Text>
        </Pressable>
    );
}

export default function Preview() {
    const params = useLocalSearchParams();
    const uri = params?.uri;
    const wasOnlineAtCapture = params?.online === "1";

    const [deviceId, setDeviceId] = useState(null);

    const [thought, setThought] = useState("…");
    const [label, setLabel] = useState(null);

    const [remainingPro, setRemainingPro] = useState(null);

    const [thinking, setThinking] = useState(false);
    const [thinkingStage, setThinkingStage] = useState("");

    const [busy, setBusy] = useState(false);
    const [mediaPerm] = MediaLibrary.usePermissions({writeOnly: true});

    const cardRef = useRef(null);
    const thinkingRef = useRef(false);

    const [adRefresh, setAdRefresh] = useState(0);
    const isPro = false;

    // ✅ Server status: OFFLINE only when ping says so
    const [serverOnline, setServerOnline] = useState(wasOnlineAtCapture);

    // -----------------------------
    // Smart Thought Nudge (non-intrusive)
    // -----------------------------
    const SMART_NUDGE_KEY = "tt_smart_nudge_dismissed";
    const [smartNudgeDismissed, setSmartNudgeDismissed] = useState(false);
    const [showSmartNudge, setShowSmartNudge] = useState(false);
    const smartNudgeTimerRef = useRef(null);

    const clearSmartNudgeTimer = () => {
        if (smartNudgeTimerRef.current) {
            clearTimeout(smartNudgeTimerRef.current);
            smartNudgeTimerRef.current = null;
        }
    };

    const showSmartNudgeOnce = useCallback(() => {
       // if (smartNudgeDismissed) return;
        if (!serverOnline) return; // no point nudging when offline

        setShowSmartNudge(true);
        clearSmartNudgeTimer();
        smartNudgeTimerRef.current = setTimeout(() => setShowSmartNudge(false), 8000)
    }, [smartNudgeDismissed, serverOnline]);

    useEffect(() => {
        (async () => {
            try {
                const v = await SecureStore.getItemAsync(SMART_NUDGE_KEY);
                setSmartNudgeDismissed(v === "1");
            } catch {
                // ignore
            }
        })();

        return () => {
            clearSmartNudgeTimer();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- helpers ---
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

    const showStage = useCallback(async (text, minMs = 0) => {
        setThinkingStage(text);
        await nextFrame();
        if (minMs > 0) await sleep(minMs);
    }, []);

    const showOfflineThought = useCallback(() => {
        setThought(pickOfflineThought());
        setLabel(null);
        setServerOnline(false);
        setShowSmartNudge(false);
    }, []);

    const preflight = useCallback(async () => {
        await showStage("Checking connection...", 150);
        const ok = await pingServer();
        setServerOnline(ok);
        return ok;
    }, [showStage]);

    const openStore = useCallback(() => {
        router.push("/buy-credits");
    }, []);

    const onDevAdd = useCallback(async () => {
        if (!deviceId) {
            Alert.alert("No device id yet", "Try again in a second.");
            return;
        }
        try {
            const r = await devAddProCredits(deviceId, 5);
            if (typeof r?.remainingPro === "number") setRemainingPro(r.remainingPro);
            //Alert.alert("Dev credits added ✅", `You now have ${r?.remainingPro ?? "?"} smart thoughts.`);
        } catch (e) {
            Alert.alert("Dev add failed", String(e?.message || e));
        }
    }, [deviceId]);

    useEffect(() => {
        setAndroidNavBarDark();
    }, []);

    // 1b) Refresh credits whenever this screen is focused again (e.g. after buying)
    useFocusEffect(
        useCallback(() => {
            let active = true;

            (async () => {
                try {
                    if (!deviceId) return;

                    const ok = await pingServer();
                    if (!active) return;

                    setServerOnline(ok);

                    if (!ok) {
                        setRemainingPro(null);
                        return;
                    }

                    const s = await getStatus(deviceId);
                    if (!active) return;

                    if (typeof s?.remainingPro === "number") setRemainingPro(s.remainingPro);
                } catch (e) {
                    console.warn("focus status refresh failed", e);
                }
            })();

            return () => {
                active = false;
            };
        }, [deviceId])
    );

    // 1) Device id + status (only if online)
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const id = await getOrCreateDeviceId();
                if (cancelled) return;
                setDeviceId(id);

                const ok = await pingServer();
                if (cancelled) return;
                setServerOnline(ok);

                if (ok) {
                    const s = await getStatus(id);
                    if (cancelled) return;
                    if (typeof s?.remainingPro === "number") setRemainingPro(s.remainingPro);
                } else {
                    setRemainingPro(null);
                }
            } catch (e) {
                console.warn("status init failed", e);
                if (!cancelled) {
                    setServerOnline(false);
                    setRemainingPro(null);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    // 2) FIRST LOAD: classify + first thought (unless offline)
    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!uri) return;

            thinkingRef.current = true;
            setThinking(true);

            try {
                const ok = await preflight();
                if (cancelled) return;

                if (!ok) {
                    showOfflineThought();
                    return;
                }

                await showStage("Looking at the photo...", 300);

                let c = null;
                try {
                    c = await classifyImage(uri);
                } catch (e) {
                    console.warn("classify failed while online", e);
                    c = null;
                }

                if (cancelled) return;

                const nextLabel = c?.ok && c?.label ? c.label : null;
                setLabel(nextLabel);

                await showStage("Thinking...", 250);

                if (!nextLabel) {
                    setThought("I can’t tell what I’m looking at… but I’m judging it anyway. 👀");
                    // Still can nudge Smart Thought (it's about quality), but only if online
                    showSmartNudgeOnce();
                    return;
                }

                const r = await getThought(nextLabel);
                if (cancelled) return;

                await showStage("Crafting response...", 180);

                setThought(r?.thought || pickOfflineThought());
                setAdRefresh((n) => n + 1);

                // ✅ Show a gentle nudge after first successful thought
                showSmartNudgeOnce();
            } catch (e) {
                console.warn(e);
                if (!cancelled) showOfflineThought();
            } finally {
                thinkingRef.current = false;
                if (!cancelled) {
                    setThinking(false);
                    setThinkingStage("");
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [uri, preflight, showStage, showOfflineThought, showSmartNudgeOnce]);

    // Button: New Thought
    const runThought = useCallback(async () => {
        if (thinkingRef.current) return;

        thinkingRef.current = true;
        setThinking(true);

        try {
            const ok = await preflight();
            if (!ok) {
                showOfflineThought();
                return;
            }

            let nextLabel = label;
            if (!nextLabel && uri) {
                await showStage("Looking again...", 250);
                const c = await classifyImage(uri).catch(() => null);
                nextLabel = c?.ok && c?.label ? c.label : null;
                setLabel(nextLabel);
            }

            if (!nextLabel) {
                Alert.alert("Couldn’t detect", "Try another photo (clearer face/pet).");
                return;
            }

            await showStage("Thinking...", 240);
            const r = await getThought(nextLabel);

            await showStage("Crafting response...", 160);
            setThought(r?.thought || pickOfflineThought());
            setAdRefresh((n) => n + 1);

            // ✅ Nudge after they use Basic Thought (once)
            showSmartNudgeOnce();
        } catch (e) {
            console.warn(e);
            showOfflineThought();
        } finally {
            thinkingRef.current = false;
            setThinking(false);
            setThinkingStage("");
        }
    }, [preflight, showOfflineThought, showStage, label, uri, showSmartNudgeOnce]);

    // Button: Smart Thought
    const runProThought = useCallback(async () => {
        if (thinkingRef.current) return;

        // ✅ Dismiss nudge forever once they try Smart Thought
        setShowSmartNudge(false);
        if (!smartNudgeDismissed) {
            setSmartNudgeDismissed(true);
            SecureStore.setItemAsync(SMART_NUDGE_KEY, "1").catch(() => {
            });
        }

        thinkingRef.current = true;
        setThinking(true);

        try {
            const ok = await preflight();
            if (!ok) {
                showOfflineThought();
                return;
            }

            if (deviceId) {
                const s = await getStatus(deviceId).catch(() => null);
                if (s?.ok && typeof s.remainingPro === "number") setRemainingPro(s.remainingPro);
            }

            let nextLabel = label;
            if (!nextLabel && uri) {
                await showStage("Looking again...", 250);
                const c = await classifyImage(uri).catch(() => null);
                nextLabel = c?.ok && c?.label ? c.label : null;
                setLabel(nextLabel);
            }

            if (!nextLabel) {
                Alert.alert("Couldn’t detect", "Try another photo (clearer face/pet).");
                return;
            }

            await showStage("Reading the scene more closely...", 250);
            const r = await getProThought(nextLabel, uri, deviceId);

            if (!r?.ok) {
                if (r?.error === "PRO_LIMIT_REACHED") {
                   /* Alert.alert("Out of Smart Thoughts", "Smart Thoughts use extra context to make the punchline better. Want more?", [
                        {text: "Not now", style: "cancel"},
                        {text: "Buy", onPress: openStore},
                    ]);*/
                    openStore()
                    return;
                }
                Alert.alert("Pro Error", "Couldn’t generate a smart thought.");
                return;
            }

            await showStage("Polishing punchline...", 150);

            setThought(r?.thought || pickOfflineThought());
            if (typeof r.remainingPro === "number") setRemainingPro(r.remainingPro);

            setAdRefresh((n) => n + 1);
        } catch (e) {
            console.warn(e);
            showOfflineThought();
        } finally {
            thinkingRef.current = false;
            setThinking(false);
            setThinkingStage("");
        }
    }, [
        preflight,
        showOfflineThought,
        showStage,
        deviceId,
        label,
        uri,
        openStore,
        smartNudgeDismissed,
    ]);

    // --- Export / Share / Download ---
    async function exportComposite() {
        try {
            setBusy(true);

            if (!cardRef.current) {
                Alert.alert("Export failed", "Preview view not ready yet.");
                return null;
            }

            const exportedUri = await captureRef(cardRef.current, {
                format: "png",
                quality: 1,
                result: "tmpfile",
            });

            return exportedUri;
        } catch (e) {
            console.warn(e);
            Alert.alert("Export failed", "Couldn’t generate the image. Try again.");
            return null;
        } finally {
            setBusy(false);
        }
    }

    async function onShare() {
        const exportedUri = await exportComposite();
        if (!exportedUri) return;

        const available = await Sharing.isAvailableAsync();
        if (!available) {
            Alert.alert("Sharing not available", "Sharing isn’t available on this device.");
            return;
        }

        await Sharing.shareAsync(exportedUri);
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
            Alert.alert("Save failed", "Couldn’t save to gallery.");
        } finally {
            setBusy(false);
        }
    }

    const disableButtons = busy || thinking;

    return (
        <>
            <StatusBar style="light"/>
            <SafeAreaView style={{flex: 1, backgroundColor: "#1e1f27"}} edges={["top", "bottom"]}>
                <View style={styles.container}>
                    <View style={styles.ad}>
                        <PreviewBannerAd enabled={!isPro} refreshKey={`${uri}-${adRefresh}`}/>
                    </View>

                    <View ref={cardRef} collapsable={false} style={styles.exportWrap}>
                        <Image source={{uri}} style={styles.image}/>

                        <View style={styles.bubblePos}>
                            <SpeechBubble text={thought || "…"}/>
                        </View>

                        {thinking ? (
                            <View style={styles.busyRow}>
                                <ActivityIndicator style={{ marginRight: 8 }} />
                                <Text style={styles.busyText}>{thinkingStage || "Thinking..."}</Text>
                            </View>
                        ) : !serverOnline ? (
                            <View style={styles.busyRow}>
                                <Text style={styles.busyText}>Offline</Text>
                            </View>
                        ) : null}

                        {/* 👇 Non-intrusive Smart Thought nudge (tap to trigger Smart or open store if 0) */}
                        {showSmartNudge && serverOnline && (
                            <Pressable
                                onPress={() => {
                                    if (typeof remainingPro === "number" && remainingPro <= 0) openStore();
                                    else runProThought();
                                    setShowSmartNudge(false);
                                }}
                                style={styles.busyRow}
                                hitSlop={10}
                            >

                                    <Text style={styles.busyText2}>
                                        {typeof remainingPro === "number" && remainingPro <= 0
                                            ? "You’re out of Smart Thoughts. Smart Thoughts use the photo and surroundings for richer, more personal lines. Tap to get more."
                                            : "Try Smart Thought. Smart Thought uses the scene and details around your pet for a more thoughtful, personalised response."}
                                    </Text>

                                <View style={styles.busyTailShadow} />
                                <View style={styles.busyArrow}/>

                            </Pressable>
                        )}

                    </View>


                    <View style={styles.controls}>
                        <View style={styles.mainButtons}>
                            <Pressable
                                style={[styles.primaryBtn, disableButtons && styles.btnDisabled]}
                                onPress={runThought}
                                disabled={disableButtons}
                            >
                                <View style={styles.btnInnerRow}>
                                    <Ionicons name="refresh" size={18} color="#1e1f27"/>
                                    <Text style={styles.primaryBtnText}>{thinking ? "Thinking…" : "Refresh"}</Text>
                                </View>
                            </Pressable>
                            <Pressable
                                style={[styles.proBtn, disableButtons && styles.btnDisabled]}
                                onPress={runProThought}
                                disabled={disableButtons}
                            >
                                <View style={styles.btnInnerRow}>
                                    <Ionicons name="rocket" size={18} color="#1e1f27"/>
                                    <Text style={styles.proBtnText}>
                                        Smart{serverOnline && typeof remainingPro === "number" ? ` (${remainingPro})` : ""}
                                    </Text>
                                </View>
                            </Pressable>
                        </View>


                        <View style={styles.shareControls}>
                            <TopIconButton icon="home-outline" label="Home" onPress={() => router.replace("/")}
                                           disabled={disableButtons}/>
                            <TopIconButton icon="camera-reverse-outline" label="Retake" onPress={() => router.back()}
                                           disabled={disableButtons}/>
                            <TopIconButton icon="share-social-outline" label="Share" onPress={onShare}
                                           disabled={disableButtons}/>
                            <TopIconButton icon="download-outline" label="Save" onPress={onDownload}
                                           disabled={disableButtons}/>
                        </View>


                        {/* DEV button if you want it back */}
                        {/* <Pressable style={[styles.primaryBtn, { marginTop: 10 }]} onPress={onDevAdd} disabled={disableButtons}>
                            <Text style={styles.primaryBtnText}>+5 (Dev)</Text>
                        </Pressable> */}
                    </View>
                </View>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},

    exportWrap: {flex: 1},
    image: {width: "100%", height: "100%", resizeMode: "cover"},

    bubblePos: {
        position: "absolute",
        top: 20,
        left: 20,
        right: 20,
        alignItems: "flex-start",
    },

    // Bottom bar (icons)
    shareControls: {
        flexDirection: "row",
        gap: 10,
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.08)",
    },

    topIconBtn: {
        flex: 1,
        height: 56,
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.08)",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
    },
    topIconBtnPressed: {transform: [{scale: 0.99}], opacity: 0.95},
    topIconBtnDisabled: {opacity: 0.5},

    topIconLabel: {
        color: "rgba(255,255,255,0.95)",
        fontWeight: "600",
        fontSize: 11,
    },

    controls: {
        gap: 10
    },

    mainButtons: {
        paddingTop: 10,
        paddingHorizontal: 10,
        flexDirection: "row",
        gap: 10
    },

    ad: {
        paddingVertical: 5
    },

    btnInnerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
    },

    primaryBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        backgroundColor: "#f8db46",
        alignItems: "center",
    },
    primaryBtnText: {
        color: "#1e1f27",
        fontWeight: "600"
    },

    proBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        backgroundColor: "#ff7c40",
        alignItems: "center",
    },

    proBtnText: {
        color: "#1e1f27",
        fontWeight: "600"
    },

    btnDisabled: {
        opacity: 0.5
    },

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
        shadowOpacity: 0.30,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6, // Android
    },

    busyText: {
        fontSize: 16,
        lineHeight: 22,
        textAlign: "center",
        color: "#2E2E2E",
        fontWeight: "400",
    },
    busyText2: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center",
        color: "#2E2E2E",
        fontWeight: "400",
    },

    busyArrow: {
        position: "absolute",
        bottom: -8,
        right: '25%',
        width: 20,
        height: 20,
        marginLeft: -10,
        backgroundColor: "#FFFFFF",
        transform: [{ rotate: "45deg" }],
        borderRadius: 3,
    },

    busyTailShadow: {
        position: "absolute",
        bottom: -12,
        right: '25%',
        marginLeft: -10,
        width: 20,
        height: 20,
        backgroundColor: "#000",
        transform: [{ rotate: "45deg" }],
        opacity: 0.1,
        borderRadius: 3,
    },

});
