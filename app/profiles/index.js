import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Image, ScrollView } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Screen from "../../src/components/ui/Screen";
import TTButton from "../../src/components/ui/TTButton";
import { useTTTheme, useGlobalStyles, makeProfilesStyles } from "../../src/theme/globalStyles";
import { getPets, deletePet, setActivePetId, getActivePetId, summarizePetForPrompt } from "../../src/services/pets";
import { AppBannerAd } from "../../src/ads/admob";
import { useEntitlements } from "../../src/state/entitlements";
import { useTTAlert } from "../../src/components/ui/TTAlert";
import { useAdGate } from "../../src/ads/useAdGate";
import PetTips from "../../src/components/ui/PetTips";
import AuthCreditsBar from "../../src/components/auth/AuthCreditsBar";
import { debouncedPushSync } from "../../src/services/syncService";
import { getLocalStreak, getTodayChallenge, getGlobalDaysLeft, getBadgeTier } from "../../src/services/challengeService";

function requiresPhoto(pet, action, alert) {
    if (!pet.avatarUri) {
        alert("No photo", `This profile needs a photo first so we've got something to ${action}.`);
        return true;
    }
    return false;
}

export default function ProfilesScreen() {
    const params = useLocalSearchParams();
    const isSelectMode = params?.mode === "select";

    const [pets, setPets] = useState([]);
    const [, setActiveId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [challengeData, setChallengeData] = useState({}); // { [petId]: { streak, todayDone, daysLeft } }

    const t = useTTTheme();
    const g = useGlobalStyles(t);
    const styles = useMemo(() => makeProfilesStyles(t), [t]);
    const { isPro, server, refreshAll, deviceId } = useEntitlements();
    const alert = useTTAlert();

    const pendingConfirmedRef = useRef(null);

    const { tryWatchAd } = useAdGate({
        onCreditsGranted: () => {
            refreshAll({ reason: "profiles_ad_credit" });
            pendingConfirmedRef.current?.();
            pendingConfirmedRef.current = null;
        },
        onLimitReached: () => router.push("/paywall"),
    });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [list, aid] = await Promise.all([getPets(), getActivePetId()]);
            const petList = Array.isArray(list) ? list : [];
            setPets(petList);
            setActiveId(aid || null);

            // Server date wins — prevents trial reset on login
            const globalDaysLeft = getGlobalDaysLeft(server?.challengeTrialStartedAt || null);
            const challengeMap = {};
            await Promise.all(petList.map(async (pet) => {
                const [streak, cached] = await Promise.all([
                    getLocalStreak(pet.id),
                    getTodayChallenge(pet.id),
                ]);
                challengeMap[pet.id] = {
                    streak: streak.count || 0,
                    todayDone: !!(cached?.completedAt),
                    daysLeft: globalDaysLeft, // same for all pets
                };
            }));
            setChallengeData(challengeMap);
        } catch (e) {
            console.warn("[profiles] load failed", e?.message || e);
            setPets([]);
            setActiveId(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const onPickActive = useCallback(async (petId) => {
        await setActivePetId(petId);
        setActiveId(petId);
        if (isSelectMode) router.back();
    }, [isSelectMode]);

    const onDelete = useCallback((pet) => {
        alert(
            "Delete profile?",
            `This removes ${pet?.name || "this pet"} from profiles.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete", style: "destructive",
                    onPress: async () => {
                        try {
                            await deletePet(pet.id);
                            debouncedPushSync(deviceId);
                            await load();
                        }
                        catch (e) { alert("Delete failed", e?.message || "Couldn't delete profile."); }
                    },
                },
            ]
        );
    }, [load, deviceId]);

    const onGetThought = useCallback(async (pet) => {
        if (requiresPhoto(pet, "judge", alert)) return;
        await setActivePetId(pet.id);
        setActiveId(pet.id);
        router.push({
            pathname: "/preview",
            params: { uri: pet.avatarUri, src: "profiles", petId: pet.id, ...(pet.petType ? { hintLabel: pet.petType } : {}) },
        });
    }, []);

    const onChat = useCallback(async (pet) => {
        if (requiresPhoto(pet, "chat", alert)) return;
        await setActivePetId(pet.id);
        setActiveId(pet.id);
        router.push({ pathname: "/ask", params: { uri: pet.avatarUri, src: "profiles", petId: pet.id } });
    }, []);

    const handleBeforeGenerate = useCallback((pet, tab, onConfirmed, onCancel) => {
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
    }, [isPro, server?.creditsRemaining, tryWatchAd]);

    const tabBtn = (active) => ({
        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
        gap: 6, paddingVertical: 9, borderRadius: 8,
        backgroundColor: t.colors.primary,
    });


    const tabBtnText = (active) => ({
        fontSize: 13, fontWeight: "600",
        color: t.colors.textOverPrimary,
    });

    return (
        <Screen style={styles.safe} edges={["top", "bottom"]}>
            <AppBannerAd enabled={!isPro} refreshKey="profiles" />

            <View style={g.screenHeader}>
                <Pressable onPress={() => router.replace("/")} style={g.screenHeaderBtn}>
                    <Text style={g.screenHeaderBtnText}>Back</Text>
                </Pressable>
                <Text style={g.screenHeaderTitle}>{isSelectMode ? "Select a Pet" : "Pet Profiles"}</Text>
                <Pressable onPress={() => router.push("/profiles/edit")} style={g.screenHeaderBtn}>
                    <Text style={g.screenHeaderBtnText}>Add</Text>
                </Pressable>
            </View>

            <AuthCreditsBar compact />

            {loading ? (
                <View style={g.center}>
                    <Text style={styles.loading}>Loading…</Text>
                </View>
            ) : pets.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>No profiles yet</Text>
                    <Text style={styles.emptySub}>Add a pet so their judgement stays consistent.</Text>
                    <TTButton title="Create Pet Profile" onPress={() => router.push("/profiles/edit")} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
                    {pets.map((pet) => {
                        const cd = challengeData[pet.id];
                        return (
                            <View key={pet.id} style={styles.card}>
                                <Pressable onPress={() => onPickActive(pet.id)} style={[g.row, { gap: 12 }]} hitSlop={10}>
                                    <View style={styles.avatarWrap}>
                                        {pet.avatarUri ? (
                                            <Image source={{ uri: pet.avatarUri }} style={styles.avatar} />
                                        ) : (
                                            <View style={[styles.avatar, styles.avatarFallback]}>
                                                <Text style={styles.avatarFallbackText}>?</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={g.flex}>
                                        <Text style={styles.name} numberOfLines={1}>{pet.name || "Unnamed"}</Text>
                                        <Text style={styles.sub} numberOfLines={1}>{pet.vibe || "Default voice"}</Text>
                                    </View>

                                    <View style={styles.actions}>
                                        <Pressable
                                            onPress={() => router.push({ pathname: "/profiles/edit", params: { id: pet.id } })}
                                            style={[styles.actionBtnBase, styles.actionBtnEdit]}
                                            hitSlop={10}
                                        >
                                            <Text style={[styles.actionBtnLabel, styles.actionBtnEditText]}>Edit</Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={() => onDelete(pet)}
                                            style={[styles.actionBtnBase, styles.actionBtnDelete]}
                                            hitSlop={10}
                                        >
                                            <Text style={[styles.actionBtnLabel, styles.actionBtnDeleteText]}>Delete</Text>
                                        </Pressable>
                                    </View>
                                </Pressable>

                                {/* Thoughts + Chat */}
                                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                                    <Pressable style={tabBtn(false)} onPress={() => onGetThought(pet)}>
                                        <Ionicons name="bulb-outline" size={15} color={t.colors.textOverPrimary} />
                                        <Text style={tabBtnText(false)}>Pet thoughts</Text>
                                    </Pressable>
                                    <Pressable style={tabBtn(false)} onPress={() => onChat(pet)}>
                                        <Ionicons name="chatbubble-outline" size={15} color={t.colors.textOverPrimary} />
                                        <Text style={tabBtnText(false)}>Chat to pet</Text>
                                    </Pressable>
                                </View>



                                {/* PetTips always visible */}
                                <PetTips
                                    pet={summarizePetForPrompt(pet)}
                                    onBeforeGenerate={(tab, onConfirmed, onCancel) => handleBeforeGenerate(pet, tab, onConfirmed, onCancel)}
                                />

                                {/* Challenge streak row */}
                                {cd ? (
                                    <Pressable
                                        onPress={() => router.push({ pathname: "/challenge", params: { petId: pet.id } })}
                                        style={{
                                            flexDirection: "row", alignItems: "center",
                                            gap: 10, marginTop: 8, paddingVertical: 8,
                                            paddingHorizontal: 10, borderRadius: 10,
                                            borderWidth: 1, borderColor: t.colors.text + "18",
                                        }}
                                    >
                                       {/* <Text style={{ fontSize: 16 }}>🏆</Text>*/}
                                        <View style={{ flex: 1 }}>
                                            <Text style={[g.text, { fontSize: 16, fontWeight: "600" }]}>
                                                {cd.streak > 0
                                                    ? `${getBadgeTier(cd.streak)?.emoji ?? ""} ${cd.streak} Day Streak!`
                                                    : "Start a challenge streak!"}
                                            </Text>
                                            {/*<Text style={[g.text, { fontSize: 11, opacity: 0.6 }]}>
                                                {isPro ? "Pro" : cd.daysLeft > 0 ? `${cd.daysLeft} free days left` : "Trial ended — Go Pro"}
                                            </Text>*/}
                                        </View>
                                        {cd.todayDone ? (
                                            <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                                        ) : (
                                            <View style={{
                                                backgroundColor: t.colors.primary, borderRadius: 6,
                                                paddingHorizontal: 14, paddingVertical: 7,
                                            }}>
                                                <Text style={{ color: t.colors.textOverPrimary, fontSize: 13, fontWeight: "700" }}>Go</Text>
                                            </View>
                                        )}
                                    </Pressable>
                                ) : null}

                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </Screen>
    );
}