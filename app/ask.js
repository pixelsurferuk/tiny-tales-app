import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View, Image, Text, Platform, Share,
    TextInput, ScrollView, Keyboard, Pressable, ActivityIndicator,
} from "react-native";

import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Screen from "../src/components/ui/Screen";
import ShareCaptionBar from "../src/components/ui/ShareCaptionBar";
import { useTTTheme, useGlobalStyles, makeAskStyles } from "../src/theme/globalStyles";
import { AppBannerAd } from "../src/ads/admob";
import { askPetQuestionFromServer } from "../src/services/ai";
import { makeImageDataUrlFree } from "../src/services/imageDataUrl";
import { getActivePet, summarizePetForPrompt, setActivePetId, upsertPet } from "../src/services/pets";
import { pickOfflineThought } from "../src/utils/OfflineThoughts";
import { parseCreditsFromResponse } from "../src/utils/credits";
import { setAndroidNavBarStyle } from "../src/utils/navBar";
import { hexToRgba } from "../src/utils/color";
import { useEntitlements } from "../src/state/entitlements";
import { CHAT_STORAGE_LIMIT, CREDIT_ERROR_CODES } from "../src/config";
import { useTTAlert } from "../src/components/ui/TTAlert";
import { useAdGate } from "../src/ads/useAdGate";
import PetHeader from "../src/components/ui/PetHeader";
import AuthCreditsBar from "../src/components/auth/AuthCreditsBar";

const _askImageCache = new Map();
const getChatKey = (petId) => `tiny_tales_chat_${petId || "unknown"}`;

// ─── Memory extraction helper ─────────────────────────────────────────────────

const MEMORY_MAX_CHARS = 500;

function extractMemory(text) {
    const patterns = [
        /my name is (.+)/i,
        /i(?:'m| am) called (.+)/i,
        /call me (.+)/i,
        /remember (?:that )?my name is (.+)/i,
        /remember (?:that )?i(?:'m| am) called (.+)/i,
        /please remember (?:that )?(.+)/i,
        /remember (?:that )?(.+)/i,
        /don't forget (?:that )?(.+)/i,
        /make sure you remember (?:that )?(.+)/i,
        /keep in mind (?:that )?(.+)/i,
        /note that (.+)/i,
        /just so you know[,]? (.+)/i,
        /fyi[,]? (.+)/i,
        /i want you to know (?:that )?(.+)/i,
        /you should know (?:that )?(.+)/i,
        /i(?:'m| am) (.+)/i,
        /i live in (.+)/i,
        /i work (?:as |in )?(.+)/i,
        /i have (?:a |an )?(.+)/i,
        /i love (.+)/i,
        /i hate (.+)/i,
        /my favourite (?:\w+ )?is (.+)/i,
        /my birthday is (.+)/i,
        /i(?:'m| am) (\d+ years old)/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) return match[1].trim().replace(/[.!?]+$/, "");
    }
    return null;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const TypingPaws = ({ styles }) => {
    const [step, setStep] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setStep((prev) => (prev + 1) % 4), 350);
        return () => clearInterval(id);
    }, []);
    return (
        <View style={{ flexDirection: "row", gap: 4, alignItems: "center", paddingVertical: 2 }}>
            {[0, 1, 2].map((i) => (
                <Ionicons
                    key={i}
                    name="paw"
                    size={14}
                    color={i < step ? "#fff" : "rgba(255,255,255,0.25)"}
                />
            ))}
        </View>
    );
};

const ChatBubble = React.memo(({ role, text, styles }) => {
    const isUser = role === "user";
    const isTyping = role === "typing";
    return (
        <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowPet]}>
            <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubblePet]}>
                {isTyping ? (
                    <TypingPaws styles={styles} />
                ) : (
                    <Text style={isUser ? styles.msgTextUser : styles.msgTextPet}>{text}</Text>
                )}
                <View
                    pointerEvents="none"
                    style={[styles.tailBase, isUser ? styles.tailUser : styles.tailPet]}
                />
            </View>
        </View>
    );
});

// ─── Chat hook ───────────────────────────────────────────────────────────────

function usePetChat(activePet, displayUri, { deviceId, isPro, onPaywall, onConsume, onSetCredits, onAlert } = {}) {
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [serverOnline, setServerOnline] = useState(true);

    const dataUrlRef = useRef(null);
    const messagesRef = useRef([]);
    const activePetId = activePet?.id || activePet?.petId;

    useEffect(() => { messagesRef.current = messages; }, [messages]);

    useEffect(() => {
        if (!activePetId) return;
        let alive = true;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(getChatKey(activePetId));
                if (raw && alive) setMessages(JSON.parse(raw) || []);
            } catch (e) {
                console.warn("Failed to load chat", e);
            }
        })();
        return () => { alive = false; };
    }, [activePetId]);

    useEffect(() => {
        if (!activePetId) return;
        const clean = messages.filter((m) => m.role !== "typing");
        if (clean.length > 0) {
            AsyncStorage.setItem(
                getChatKey(activePetId),
                JSON.stringify(clean.slice(-CHAT_STORAGE_LIMIT))
            ).catch(() => {});
        }
    }, [messages, activePetId]);

    const sendMessage = useCallback(
        async (questionText) => {
            const q = String(questionText || "").trim();
            if (!q || isTyping) return;

            if (!displayUri) { onAlert?.("No photo", "Pick a pet with a profile photo first."); return; }
            if (!deviceId) { onAlert?.("Sorry, we are still setting up this device.", "Try again in a second."); return; }

            const userMsg = { role: "user", text: q, ts: Date.now() };
            setMessages((prev) => [
                ...prev.filter((m) => m.role !== "typing"),
                userMsg,
                { role: "typing", ts: Date.now() + 1 },
            ]);
            setIsTyping(true);

            const newMemory = extractMemory(q);
            if (newMemory && activePet?.id) {
                try {
                    const existing = String(activePet.memory || "").trim();
                    const combined = existing ? `${existing}. ${newMemory}` : newMemory;
                    const updated = combined.length > MEMORY_MAX_CHARS
                        ? combined.slice(combined.length - MEMORY_MAX_CHARS)
                        : combined;
                    await upsertPet({ ...activePet, memory: updated });
                    activePet.memory = updated;
                } catch (e) {
                    if (__DEV__) console.warn("[memory] save failed", e?.message);
                }
            }

            try {
                if (!_askImageCache.has(displayUri)) {
                    _askImageCache.set(displayUri, await makeImageDataUrlFree(displayUri));
                }
                dataUrlRef.current = _askImageCache.get(displayUri);

                const history = (messagesRef.current || [])
                    .filter((m) => m.role !== "typing")
                    .slice(-10)
                    .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

                const response = await askPetQuestionFromServer({
                    identityId: deviceId,
                    imageDataUrl: dataUrlRef.current,
                    question: q,
                    pet: summarizePetForPrompt(activePet) || {},
                    history,
                });

                setServerOnline(true);

                if (!isPro) {
                    const patch = parseCreditsFromResponse(response);
                    if (typeof onSetCredits === "function" && Object.values(patch).some((v) => v !== null)) {
                        onSetCredits(patch);
                    } else if (typeof onConsume === "function") {
                        onConsume();
                    }
                }

                const answer = response?.answer || response?.thought || pickOfflineThought();
                setMessages((prev) => [
                    ...prev.filter((m) => m.role !== "typing"),
                    { role: "pet", text: answer, ts: Date.now() },
                ]);
            } catch (e) {
                const errCode = e?.data?.error;
                if (CREDIT_ERROR_CODES.has(errCode)) {
                    setServerOnline(true);
                    if (typeof onPaywall === "function") onPaywall();
                    setMessages((prev) => prev.filter((m) => m.role !== "typing"));
                    return;
                }
                console.warn("Chat Error:", { message: e?.message, code: e?.code, status: e?.status, data: e?.data });
                setServerOnline(false);
                setMessages((prev) => [
                    ...prev.filter((m) => m.role !== "typing"),
                    { role: "pet", text: pickOfflineThought(), ts: Date.now() },
                ]);
            } finally {
                setIsTyping(false);
            }
        },
        [activePet, displayUri, deviceId, isPro, isTyping, onConsume, onPaywall, onSetCredits, onAlert]
    );

    return { messages, isTyping, sendMessage, serverOnline };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function Ask() {
    const params = useLocalSearchParams();
    const t = useTTTheme();
    const g = useGlobalStyles(t);
    const styles = useMemo(() => makeAskStyles(t), [t]);
    const scrollRef = useRef(null);
    const cardRef = useRef(null);

    const { deviceId, isPro, server, refreshAll, consumeCreditLocally, setCreditsLocal } = useEntitlements();

    const [activePet, setActivePet] = useState(null);
    const [inputText, setInputText] = useState("");
    const [isExporting, setIsExporting] = useState(false);
    const [showCaption, setShowCaption] = useState(false);

    const uriParam = typeof params?.uri === "string" ? params.uri : null;
    const petIdParam = typeof params?.petId === "string" ? params.petId : null;

    const displayUri = useMemo(() => uriParam || activePet?.avatarUri || null, [uriParam, activePet]);
    const [mediaPerm] = MediaLibrary.usePermissions({ writeOnly: true });

    const openPaywall = useCallback(() => {
        router.push({ pathname: "/paywall", params: { source: "chat" } });
    }, []);

    const remaining = typeof server?.creditsRemaining === "number" ? server.creditsRemaining : 0;
    const isOutOfFree = !isPro && remaining <= 0;

    const alert = useTTAlert();

    const pendingQuestionRef = useRef(null);

    const { tryWatchAd, isWatchingAd } = useAdGate({
        onCreditsGranted: () => {
            if (pendingQuestionRef.current) {
                const q = pendingQuestionRef.current;
                pendingQuestionRef.current = null;
                setTimeout(() => sendMessage(q), 300);
            }
        },
        onLimitReached: openPaywall,
    });

    const { messages, isTyping, sendMessage, serverOnline } = usePetChat(activePet, displayUri, {
        deviceId,
        isPro,
        onPaywall: () => {
            if (pendingQuestionRef.current) {
                tryWatchAd();
            } else {
                openPaywall();
            }
        },
        onConsume: consumeCreditLocally,
        onSetCredits: setCreditsLocal,
        onAlert: alert,
    });

    useEffect(() => { setAndroidNavBarStyle("light"); }, []);

    useFocusEffect(
        useCallback(() => {
            let alive = true;
            (async () => {
                try {
                    if (petIdParam) await setActivePetId(petIdParam);
                    const pet = await getActivePet();
                    if (!alive) return;
                    setActivePet(pet);
                    await new Promise((resolve) => setTimeout(resolve, 400));
                    if (!alive) return;
                    await refreshAll({ reason: "ask_focus", retries: 1, delayMs: 300 });
                } catch { /* ignore */ }
            })();
            return () => { alive = false; };
        }, [petIdParam, refreshAll])
    );

    // Only scroll to end when new messages arrive
    const prevMessageCountRef = useRef(0);
    useEffect(() => {
        if (messages.length > prevMessageCountRef.current) {
            prevMessageCountRef.current = messages.length;
            const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
            return () => clearTimeout(id);
        }
    }, [messages]);

    const handleSend = () => {
        if (isOutOfFree) {
            pendingQuestionRef.current = inputText.trim();
            setInputText("");
            tryWatchAd();
            return;
        }
        sendMessage(inputText);
        setInputText("");
    };

    const handleExport = async () => {
        if (!cardRef.current) return null;
        try {
            setIsExporting(true);
            setShowCaption(true);
            await new Promise((resolve) => setTimeout(resolve, 150));
            const result = await captureRef(cardRef.current, { format: "png", quality: 1, result: "tmpfile" });
            setShowCaption(false);
            return result;
        } catch {
            setShowCaption(false);
            alert("Export Error", "Could not generate image.");
            return null;
        } finally {
            setIsExporting(false);
        }
    };

    const handleShare = async () => {
        const uri = await handleExport();
        if (!uri) return;
        try {
            if (Platform.OS === "ios") {
                await Share.share({ url: uri });
            } else {
                await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share Tiny Tales" });
            }
        } catch { /* ignore */ }
    };

    const handleDownload = async () => {
        const uri = await handleExport();
        if (!uri) return;
        if (!mediaPerm?.granted) {
            const { granted } = await MediaLibrary.requestPermissionsAsync();
            if (!granted) return alert("Permission needed", "Please allow photo access.");
        }
        await MediaLibrary.saveToLibraryAsync(uri);
        alert("Saved", "Image saved to gallery.");
    };

    const disableChat = isTyping || isExporting || isWatchingAd;

    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const show = Keyboard.addListener("keyboardDidShow", (e) => {
            setKeyboardHeight(e.endCoordinates.height);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        });
        const hide = Keyboard.addListener("keyboardDidHide", () => {
            setKeyboardHeight(0);
        });
        return () => { show.remove(); hide.remove(); };
    }, []);

    return (
        <>
            <Screen style={styles.container} edges={["top", "bottom"]}>
                <View style={[styles.contentContainer, { paddingBottom: keyboardHeight }]}>

                        <AppBannerAd enabled={!isPro} refreshKey={`ask-${displayUri}`} />

                        <PetHeader
                            petName={activePet?.name}
                            avatarUri={displayUri}
                            onBack={() => router.back()}
                            onShare={handleShare}
                            onDownload={handleDownload}
                            disabled={isExporting}
                        />

                        <AuthCreditsBar compact />

                        <View ref={cardRef} collapsable={false} style={styles.cardWrap}>
                            <View style={styles.imageWrap}>
                                <Image
                                    //source={displayUri ? { uri: displayUri } : null}
                                    source={require("../assets/images/ask-bg.webp")}
                                    style={[g.coverImage, !displayUri && { backgroundColor: "#111" }]}
                                />

                                <Pressable style={styles.dismissLayer} onPress={Keyboard.dismiss} />

                                {/*{!serverOnline && (
                                    <View style={styles.offlineRow}>
                                        <Text style={styles.offlineText}>Offline Mode</Text>
                                    </View>
                                )}*/}

                                <View style={styles.chatOverlay}>
                                    <View style={styles.chatPanel}>
                                        <ScrollView
                                            ref={scrollRef}
                                            style={g.flex}
                                            contentContainerStyle={styles.chatContent}
                                            keyboardShouldPersistTaps="handled"
                                            showsVerticalScrollIndicator={false}
                                        >
                                            {messages.map((m, i) => (
                                                <ChatBubble key={`${m.ts}-${i}`} role={m.role} text={m.text} styles={styles} />
                                            ))}
                                        </ScrollView>
                                    </View>
                                </View>
                            </View>

                            {showCaption && <ShareCaptionBar />}
                        </View>

                        <View style={styles.inputRow}>
                            {isWatchingAd ? (
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 8 }}>
                                    <ActivityIndicator color={t.colors.primary} />
                                    <Text style={[g.text, { opacity: 0.7 }]}>Loading ad…</Text>
                                </View>
                            ) : (
                                <>
                                    <View style={[styles.inputWrap, disableChat && { opacity: 0.6 }]}>
                                        <Ionicons
                                            name="chatbubble-ellipses-outline"
                                            size={18}
                                            color={hexToRgba(t.colors.text, 0.4)}
                                        />
                                        <TextInput
                                            value={inputText}
                                            onChangeText={setInputText}
                                            placeholder={`Chat with ${activePet?.name || "pet"}…`}
                                            placeholderTextColor={hexToRgba(t.colors.text, 0.4)}
                                            style={styles.input}
                                            editable={!disableChat}
                                            returnKeyType="send"
                                            onSubmitEditing={handleSend}
                                            maxLength={500}
                                            blurOnSubmit={false}
                                        />
                                    </View>

                                    <Pressable
                                        onPress={handleSend}
                                        disabled={disableChat || !inputText.trim()}
                                        style={({ pressed }) => [
                                            styles.sendBtn,
                                            (!inputText.trim() || disableChat) && { opacity: 0.5 },
                                            pressed && { transform: [{ scale: 0.96 }] },
                                        ]}
                                    >
                                        <Ionicons name="send" size={18} color={t.colors.textOverPrimary} />
                                    </Pressable>
                                </>
                            )}

                        </View>
                    </View>
            </Screen>
        </>
    );
}