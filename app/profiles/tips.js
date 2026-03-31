import React, { useCallback, useRef, useState } from "react";
import { View, Image, ScrollView, Platform, Share } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";

import Screen from "../../src/components/ui/Screen";
import PetHeader from "../../src/components/ui/PetHeader";
import AuthCreditsBar from "../../src/components/auth/AuthCreditsBar";
import ShareCaptionBar from "../../src/components/ui/ShareCaptionBar";
import PetTips from "../../src/components/ui/PetTips";
import { AppBannerAd } from "../../src/ads/admob";
import { useTTTheme } from "../../src/theme/globalStyles";
import { useEntitlements } from "../../src/state/entitlements";
import { useTTAlert } from "../../src/components/ui/TTAlert";
import { useAdGate } from "../../src/ads/useAdGate";
import { getActivePet, setActivePetId, summarizePetForPrompt } from "../../src/services/pets";

export default function PetTipsScreen() {
    const params = useLocalSearchParams();
    const petIdParam = typeof params?.petId === "string" ? params.petId : null;

    const t = useTTTheme();
    const { isPro, server, refreshAll } = useEntitlements();
    const alert = useTTAlert();

    const [pet, setPet] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [showCaption, setShowCaption] = useState(false);

    const cardRef = useRef(null);
    const pendingConfirmedRef = useRef(null);
    const [mediaPerm] = MediaLibrary.usePermissions({ writeOnly: true });

    useFocusEffect(
        useCallback(() => {
            let alive = true;
            (async () => {
                try {
                    if (petIdParam) await setActivePetId(petIdParam);
                    const loaded = await getActivePet();
                    if (alive) setPet(loaded || null);
                    await refreshAll({ reason: "tips_focus", retries: 1, delayMs: 300 });
                } catch { /* ignore */ }
            })();
            return () => { alive = false; };
        }, [petIdParam, refreshAll])
    );

    const { tryWatchAd, isWatchingAd } = useAdGate({
        onCreditsGranted: () => {
            refreshAll({ reason: "tips_ad_credit" });
            pendingConfirmedRef.current?.();
            pendingConfirmedRef.current = null;
        },
        onLimitReached: () => router.push("/paywall"),
    });

    const handleBeforeGenerate = useCallback((tab, onConfirmed, onCancel) => {
        const creditsRemaining = server?.creditsRemaining ?? 0;

        if (!isPro && creditsRemaining <= 0) {
            pendingConfirmedRef.current = onConfirmed;
            tryWatchAd();
            return;
        }

        if (!isPro) {
            alert(
                "Uses 1 credit",
                `Getting a ${tab === "training" ? "training tip" : "brain game"} uses 1 credit. You have ${creditsRemaining} remaining.`,
                [
                    { text: "Continue", onPress: onConfirmed },
                    { text: "Cancel", style: "cancel", onPress: onCancel },
                ]
            );
            return;
        }

        onConfirmed();
    }, [isPro, server?.creditsRemaining, tryWatchAd, alert]);

    const exportImage = async () => {
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
            return null;
        } finally {
            setIsExporting(false);
        }
    };

    const handleShare = async () => {
        const uri = await exportImage();
        if (!uri) return;
        if (Platform.OS === "ios") {
            await Share.share({ url: uri });
        } else {
            await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share Tiny Tales" });
        }
    };

    const handleDownload = async () => {
        const uri = await exportImage();
        if (!uri) return;
        if (!mediaPerm?.granted) {
            const { granted } = await MediaLibrary.requestPermissionsAsync(true);
            if (!granted) return;
        }
        await MediaLibrary.saveToLibraryAsync(uri);
        alert("Saved", "Image saved to gallery.");
    };

    const disabled = isExporting || isWatchingAd;

    return (
        <>
            <StatusBar style={t.isDark ? "light" : "dark"} />
            <Screen style={{ flex: 1, backgroundColor: t.colors.bg }} edges={["top", "bottom"]}>

                <AppBannerAd enabled={!isPro} refreshKey={`tips-${pet?.id}`} />

                <PetHeader
                    petName={pet?.name}
                    avatarUri={pet?.avatarUri}
                    onBack={() => router.back()}
                    onShare={handleShare}
                    onDownload={handleDownload}
                    disabled={disabled}
                />

                <AuthCreditsBar compact />

                <View ref={cardRef} collapsable={false}>
                    <Image
                        source={pet?.avatarUri ? { uri: pet.avatarUri } : null}
                        style={{
                            width: "100%",
                            height: 280,
                            backgroundColor: t.colors.cardBG,
                        }}
                        resizeMode="cover"
                    />
                    {showCaption && <ShareCaptionBar />}
                </View>

                <ScrollView
                    contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <PetTips
                        pet={summarizePetForPrompt(pet)}
                        onBeforeGenerate={handleBeforeGenerate}
                    />
                </ScrollView>

            </Screen>
        </>
    );
}
