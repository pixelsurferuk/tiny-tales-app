import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Image,
    StyleSheet,
    Text,
    Alert,
    Platform,
    Share,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Keyboard,
    Pressable,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Screen from "../src/components/ui/Screen";
import TTButton from "../src/components/ui/TTButton";
import ShareCaptionBar from "../src/components/ui/ShareCaptionBar";
import { useTTTheme } from "../src/theme";
import { AppBannerAd } from "../src/ads/admob";
import ThoughtBottomBar from "../src/components/ui/ThoughtBottomBar";
import { askPetQuestionFromServer } from "../src/services/ai";
import { makeImageDataUrlFree } from "../src/services/imageDataUrl";

// Module-level cache — persists across mounts so re-opening chat
// with the same pet doesn't re-process the image
const _askImageCache = new Map();
import { getActivePet, summarizePetForPrompt, setActivePetId } from "../src/services/pets";
import { pickOfflineThought } from "../src/utils/OfflineThoughts";
import { parseCreditsFromResponse } from "../src/utils/credits";
import { setAndroidNavBarStyle } from "../src/utils/navBar";
import { hexToRgba } from "../src/utils/color";
import { useEntitlements } from "../src/state/entitlements";
import { CHAT_STORAGE_LIMIT, CREDIT_ERROR_CODES } from "../src/config";

const getChatKey = (petId) => `tiny_tales_chat_${petId || "unknown"}`;

// ─── Sub-components ──────────────────────────────────────────────────────────

const TypingText = ({ styles }) => {
    const [dots, setDots] = useState(".");
    useEffect(() => {
        const id = setInterval(() => {
            setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
        }, 350);
        return () => clearInterval(id);
    }, []);
    return <Text style={styles.msgTextPet}>{dots}</Text>;
};

const ChatBubble = React.memo(({ role, text, styles }) => {
    const isUser = role === "user";
    const isTyping = role === "typing";
    return (
        <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowPet]}>
            <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubblePet]}>
                {isTyping ? (
                    <TypingText styles={styles} />
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

function usePetChat(activePet, displayUri, { deviceId, isPro, onPaywall, onConsume, onSetCredits } = {}) {
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

            if (!displayUri) {
                Alert.alert("No photo", "Pick a pet with a profile photo first.");
                return;
            }
            if (!deviceId) {
                Alert.alert("Sorry, we are still setting up this device.", "Try again in a second.");
                return;
            }

            const userMsg = { role: "user", text: q, ts: Date.now() };
            setMessages((prev) => [
                ...prev.filter((m) => m.role !== "typing"),
                userMsg,
                { role: "typing", ts: Date.now() + 1 },
            ]);
            setIsTyping(true);

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

                console.warn("Chat Error:", {
                    message: e?.message,
                    code: e?.code,
                    status: e?.status,
                    data: e?.data,
                    body: typeof e?.body === "string" ? e.body.slice(0, 300) : e?.body,
                });

                setServerOnline(false);
                setMessages((prev) => [
                    ...prev.filter((m) => m.role !== "typing"),
                    { role: "pet", text: pickOfflineThought(), ts: Date.now() },
                ]);
            } finally {
                setIsTyping(false);
            }
        },
        [activePet, displayUri, deviceId, isPro, isTyping, onConsume, onPaywall, onSetCredits]
    );

    return { messages, isTyping, sendMessage, serverOnline };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

const makeStyles = (t) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: t.colors.bg },
        contentContainer: { flex: 1 },
        cardWrap: { flex: 1, flexDirection: "column" },
        imageWrap: { flex: 1 },
        image: { width: "100%", height: "100%", resizeMode: "cover" },
        dismissLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
        offlineRow: {
            position: "absolute",
            top: 12,
            alignSelf: "center",
            backgroundColor: "rgba(255,255,255,0.9)",
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 20,
            zIndex: 10,
            elevation: 6,
        },
        offlineText: { fontSize: 12, fontWeight: "700", color: "#333" },
        chatOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 },
        chatPanel: { flex: 1, backgroundColor: "rgba(10,12,18,0.4)" },
        chatContentBase: {
            flexGrow: 1,
            justifyContent: "flex-end",
            gap: 10,
            paddingHorizontal: 20,
            paddingBottom: 15,
        },
        msgRow: { width: "100%", flexDirection: "row" },
        msgRowUser: { justifyContent: "flex-end" },
        msgRowPet: { justifyContent: "flex-start" },
        bubble: { position: "relative", maxWidth: "85%", minWidth: 40, padding: 12, borderRadius: 16 },
        bubbleUser: { backgroundColor: t.colors.primary, borderTopRightRadius: 2 },
        bubblePet: { backgroundColor: t.colors.secondary, borderTopLeftRadius: 2 },
        msgTextUser: { color: t.colors.textOverPrimary, fontWeight: "500", fontSize: 15, lineHeight: 20 },
        msgTextPet: { color: t.colors.textOverSecondary, fontWeight: "500", fontSize: 15, lineHeight: 20 },
        tailBase: {
            position: "absolute",
            top: 0,
            width: 0,
            height: 0,
            borderLeftWidth: 8,
            borderRightWidth: 8,
            borderTopWidth: 12,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
        },
        tailUser: { right: -6, borderTopColor: t.colors.primary },
        tailPet: { left: -6, borderTopColor: t.colors.secondary },
        inputRow: {
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
            padding: 12,
            backgroundColor: t.colors.bg,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
        },
        inputWrap: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: t.isDark ? "rgba(255,255,255,0.08)" : "rgba(11,16,32,0.04)",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: t.colors.border,
            paddingHorizontal: 12,
            height: 50,
            gap: 8,
        },
        input: { flex: 1, color: t.colors.text, fontSize: 16 },
        sendBtn: {
            width: 50,
            height: 50,
            borderRadius: 12,
            backgroundColor: t.colors.primary,
            alignItems: "center",
            justifyContent: "center",
            elevation: 4,
        },
    });

export default function Ask() {
    const params = useLocalSearchParams();
    const t = useTTTheme();
    const styles = useMemo(() => makeStyles(t), [t]);
    const scrollRef = useRef(null);
    const cardRef = useRef(null);

    const { deviceId, isPro, server, refreshAll, consumeCreditLocally, setCreditsLocal } = useEntitlements();

    const [activePet, setActivePet] = useState(null);
    const [inputText, setInputText] = useState("");
    const [isExporting, setIsExporting] = useState(false);
    const [showCaption, setShowCaption] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    const uriParam = typeof params?.uri === "string" ? params.uri : null;
    const petIdParam = typeof params?.petId === "string" ? params.petId : null;
    const fromProfiles = params?.src === "profiles";

    const displayUri = useMemo(() => uriParam || activePet?.avatarUri || null, [uriParam, activePet]);
    const [mediaPerm] = MediaLibrary.usePermissions({ writeOnly: true });

    const openPaywall = useCallback(() => {
        router.push({ pathname: "/paywall", params: { source: "chat" } });
    }, []);

    const remaining = typeof server?.creditsRemaining === "number" ? server.creditsRemaining : 0;
    const canChat = isPro || remaining > 0;
    const isOutOfFree = !isPro && remaining <= 0;

    const { messages, isTyping, sendMessage, serverOnline } = usePetChat(activePet, displayUri, {
        deviceId,
        isPro,
        onPaywall: openPaywall,
        onConsume: consumeCreditLocally,
        onSetCredits: setCreditsLocal,
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
                    // Delay gives any in-flight paywall purchase refresh time to
                    // complete and release the refreshing lock before we run
                    await new Promise((resolve) => setTimeout(resolve, 400));
                    if (!alive) return;
                    await refreshAll({ reason: "ask_focus", retries: 1, delayMs: 300 });
                } catch {
                    // ignore
                }
            })();
            return () => { alive = false; };
        }, [petIdParam, refreshAll])
    );

    useEffect(() => {
        const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        return () => clearTimeout(id);
    }, [messages, keyboardVisible]);

    useEffect(() => {
        const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
        const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
        return () => { show.remove(); hide.remove(); };
    }, []);

    const handleSend = () => {
        if (!canChat) { openPaywall(); return; }
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
            Alert.alert("Export Error", "Could not generate image.");
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
            if (!granted) return Alert.alert("Permission needed", "Please allow photo access.");
        }
        await MediaLibrary.saveToLibraryAsync(uri);
        if(__DEV__) Alert.alert("Saved", "Image saved to gallery.");
    };

    const disableChat = isTyping || isExporting || !canChat;

    return (
        <>
            <StatusBar style={t.isDark ? "light" : "dark"} />
            <Screen style={styles.container} edges={["top", "bottom"]}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
                >
                    <View style={styles.contentContainer}>
                        <AppBannerAd enabled={!isPro} refreshKey={`ask-${displayUri}`} />

                        <View ref={cardRef} collapsable={false} style={styles.cardWrap}>
                            <View style={styles.imageWrap}>
                                <Image
                                    source={displayUri ? { uri: displayUri } : null}
                                    style={[styles.image, !displayUri && { backgroundColor: "#111" }]}
                                />

                                <Pressable style={styles.dismissLayer} onPress={Keyboard.dismiss} />

                                {!serverOnline && (
                                    <View style={styles.offlineRow}>
                                        <Text style={styles.offlineText}>Offline Mode</Text>
                                    </View>
                                )}

                                <View style={styles.chatOverlay}>
                                    <View style={styles.chatPanel}>
                                        <ScrollView
                                            ref={scrollRef}
                                            style={{ flex: 1 }}
                                            contentContainerStyle={styles.chatContentBase}
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
                            {isOutOfFree ? (
                                <TTButton
                                    variant="success"
                                    style={{ flex: 1 }}
                                    leftIcon={<Ionicons name="chatbubbles" size={18} color={t.colors.textOverSecondary} />}
                                    onPress={openPaywall}
                                    title="Unlock More Messages"
                                />
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
                </KeyboardAvoidingView>

                <ThoughtBottomBar
                    disableButtons={isExporting}
                    backIcon={fromProfiles ? "paw-outline" : "arrow-back-outline"}
                    backLabel={fromProfiles ? "Profiles" : "Back"}
                    onHome={() => router.replace("/")}
                    onBack={() => router.back()}
                    onShare={handleShare}
                    onDownload={handleDownload}
                />
            </Screen>
        </>
    );
}
