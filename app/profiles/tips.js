import React, { useCallback, useRef, useState } from "react";
import {Pressable, ScrollView, Text, View} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";

import Screen from "../../src/components/ui/Screen";
import PetHeader from "../../src/components/ui/PetHeader";
import AuthCreditsBar from "../../src/components/auth/AuthCreditsBar";
import PetTips from "../../src/components/ui/PetTips";
import { AppBannerAd } from "../../src/ads/admob";
import { useTTTheme, useGlobalStyles } from "../../src/theme/globalStyles";
import { useEntitlements } from "../../src/state/entitlements";
import { useTTAlert } from "../../src/components/ui/TTAlert";
import { useAdGate } from "../../src/ads/useAdGate";
import { getActivePet, setActivePetId, summarizePetForPrompt } from "../../src/services/pets";

export default function PetTipsScreen() {
    const params = useLocalSearchParams();
    const petIdParam = typeof params?.petId === "string" ? params.petId : null;
    const tabParam = typeof params?.tab === "string" ? params.tab : null;
    const t = useTTTheme();
    const g = useGlobalStyles(t);
    const { isPro, server, refreshAll } = useEntitlements();
    const alert = useTTAlert();

    const [pet, setPet] = useState(null);

    const pendingConfirmedRef = useRef(null);

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

    return (
        <>
            <StatusBar style={t.isDark ? "light" : "dark"} />
            <Screen style={{ flex: 1, backgroundColor: t.colors.bg }} edges={["top", "bottom"]}>

                <AppBannerAd enabled={!isPro} refreshKey={`tips-${pet?.id}`} />


                <View style={g.screenHeader}>
                    <Pressable onPress={() => router.back()} style={g.screenHeaderBtn}>
                        <Text style={g.screenHeaderBtnText}>Back</Text>
                    </Pressable>
                    <Text style={[g.screenHeaderTitle, {flexShrink: 1}]} numberOfLines={2}>{pet?.name}'s Training Area</Text>
                </View>



                <AuthCreditsBar compact />

                <ScrollView
                    contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <PetTips
                        pet={summarizePetForPrompt(pet)}
                        onBeforeGenerate={handleBeforeGenerate}
                        initialTab={tabParam}
                    />
                </ScrollView>

            </Screen>
        </>
    );
}
