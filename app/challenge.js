// app/challenge.js
import React, { useCallback, useEffect, useState } from "react";
import {
    View, Text, Pressable, ScrollView, ActivityIndicator, Image
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Screen from "../src/components/ui/Screen";
import TTButton from "../src/components/ui/TTButton";
import { useTTTheme, useGlobalStyles } from "../src/theme/globalStyles";
import { useEntitlements } from "../src/state/entitlements";
import { getPets, getActivePet, summarizePetForPrompt } from "../src/services/pets";
import { getAgeRangeFromLabel } from "../src/utils/ageRange";
import { debouncedPushSync } from "../src/services/syncService";
import {
    fetchTodayChallenge, completeChallenge,
    getLocalStreak, getLocalBadges, saveLocalStreak, saveLocalBadges,
    getTodayChallenge, saveTodayChallenge,
    todayUTC,
    getGlobalDaysLeft, getBadgeTier, clearLocalChallengeData,
} from "../src/services/challengeService";
import { useTTAlert } from "../src/components/ui/TTAlert";
import { AppBannerAd } from "../src/ads/admob";

const STREAK_MILESTONES = [7, 14, 21, 28, 35];

function getNextMilestone(count) {
    return STREAK_MILESTONES.find(m => m > count) || null;
}

export default function PetChallengeClub() {
    const t = useTTTheme();
    const g = useGlobalStyles(t);
    const { deviceId: identityId, isPro, server } = useEntitlements();
    const alert = useTTAlert();
    const params = useLocalSearchParams();
    const petIdParam = params?.petId ? String(params.petId) : null;

    const [activePet, setActivePet] = useState(null);
    const [challenge, setChallenge] = useState(null);
    const [streak, setStreak] = useState({ count: 0, lastCompletedDate: null, startDate: null });
    const [badges, setBadges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [completing, setCompleting] = useState(false);
    const [globalDaysLeft, setGlobalDaysLeft] = useState(4);
    const [reaction, setReaction] = useState(null);
    const [completed, setCompleted] = useState(false);

    const daysLeftInTrial = globalDaysLeft;
    const inTrial = daysLeftInTrial > 0;
    const canUse = isPro || inTrial;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            let pet = null;
            if (petIdParam) {
                const pets = await getPets();
                pet = pets.find(p => p.id === petIdParam) || null;
            }
            if (!pet) pet = await getActivePet();
            if (!pet) { setLoading(false); return; }
            setActivePet(pet);

            const [localStreak, localBadges] = await Promise.all([
                getLocalStreak(pet.id),
                getLocalBadges(pet.id),
            ]);
            setStreak(localStreak);
            setBadges(localBadges);

            // Global trial state — server.challengeTrialStartedAt is the source of truth
            const globalTrialDate = server?.challengeTrialStartedAt || null;
            if (globalTrialDate) {
                setGlobalDaysLeft(getGlobalDaysLeft(globalTrialDate));
            }

            const cached = await getTodayChallenge(pet.id);
            if (cached) {
                setChallenge(cached);
                if (cached.completedAt) {
                    setCompleted(true);
                    setReaction(cached.reaction || null);
                }
                // Use cached trialStartedAt only if server didn't provide one
                if (!globalTrialDate && cached.trialStartedAt) {
                    setGlobalDaysLeft(getGlobalDaysLeft(cached.trialStartedAt));
                }
                setLoading(false);
                return;
            }

            if (!identityId) { setLoading(false); return; }
            const ageRange = getAgeRangeFromLabel(pet.age);
            const result = await fetchTodayChallenge(identityId, pet.id, pet.petType || "pet", ageRange);

            // Fall back to trialStartedAt from challenge fetch if server status didn't have it
            if (!globalTrialDate && result.trialStartedAt) {
                setGlobalDaysLeft(getGlobalDaysLeft(result.trialStartedAt));
            }

            setChallenge(result.challenge);
            await saveTodayChallenge(pet.id, {
                ...result.challenge,
                trialStartedAt: result.trialStartedAt,
            });
        } catch (e) {
            console.warn("[challenge] load error", e?.message);
        } finally {
            setLoading(false);
        }
    }, [identityId, petIdParam, server?.challengeTrialStartedAt]);

    useEffect(() => { load(); }, [load]);

    const handleComplete = useCallback(async () => {
        if (!challenge || !activePet || completing || completed) return;
        if (!canUse) {
            router.push("/paywall");
            return;
        }

        setCompleting(true);
        try {
            const petSummary = summarizePetForPrompt(activePet);
            const result = await completeChallenge(identityId, activePet.id, challenge.id, petSummary);

            setReaction(result.reaction);
            setCompleted(true);

            const today = todayUTC();
            const alreadyToday = streak.lastCompletedDate === today;

            if (!alreadyToday) {
                const newCount = result.streak; // server is source of truth
                const isConsecutive = newCount > 1;
                const newStartDate = isConsecutive ? streak.startDate : today;
                const newStreak = { count: newCount, lastCompletedDate: today, startDate: newStartDate };
                setStreak(newStreak);
                await saveLocalStreak(activePet.id, newStreak);

                const newBadges = [...badges, { date: today, streakDay: newCount }];
                setBadges(newBadges);
                await saveLocalBadges(activePet.id, newBadges);
            }

            debouncedPushSync(identityId);

            await saveTodayChallenge(activePet.id, {
                ...challenge,
                completedAt: new Date().toISOString(),
                reaction: result.reaction,
                trialStartedAt: challenge.trialStartedAt,
            });
        } catch {
            alert("Couldn't complete", "Something went wrong. Try again!");
        } finally {
            setCompleting(false);
        }
    }, [challenge, activePet, completing, completed, canUse, streak, badges, identityId]);

    const badgeTier = getBadgeTier(streak.count);
    const nextMilestone = getNextMilestone(streak.count);

    if (loading) {
        return (
            <Screen edges={["top", "bottom"]}>
                <View style={g.center}><ActivityIndicator color={t.colors.primary} /></View>
            </Screen>
        );
    }

    if (!activePet) {
        return (
            <Screen edges={["top", "bottom"]}>
                <View style={g.screenHeader}>
                    <Pressable onPress={() => router.back()} style={g.screenHeaderBtn}>
                        <Text style={g.screenHeaderBtnText}>Back</Text>
                    </Pressable>
                    <Text style={[g.screenHeaderTitle, {flexShrink: 1}]}>Pet Challenges</Text>
                    <View style={{ width: 60 }} />
                </View>
                <View style={[g.center, { padding: 24 }]}>
                    <Text style={[g.subTitle, { textAlign: "center", marginBottom: 8 }]}>No pet profile yet</Text>
                    <Text style={[g.text, { textAlign: "center", opacity: 0.6, marginBottom: 16 }]}>
                        Set up a pet profile to start the Challenge Club.
                    </Text>
                    <TTButton title="Set Up A Pet Profile" onPress={() => router.push("/profiles/edit")} />
                </View>
            </Screen>
        );
    }

    return (
        <Screen edges={["top", "bottom"]}>
            <AppBannerAd enabled={!isPro} refreshKey="challenge" />

            <View style={g.screenHeader}>
                <Pressable onPress={() => router.back()} style={g.screenHeaderBtn}>
                    <Text style={g.screenHeaderBtnText}>Back</Text>
                </Pressable>
                <Text style={[g.screenHeaderTitle, {flexShrink: 1}]}>Pet Challenges</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} showsVerticalScrollIndicator={false}>

                {/* Trial ended / paywall banner — only show when trial is over and not pro */}
                {!isPro && !inTrial ? (
                    <View style={{
                        backgroundColor: t.colors.cardBG,
                        borderRadius: 12, padding: 12, borderWidth: 1,
                        borderColor: t.colors.text + "22",
                        flexDirection: "column", alignItems: "center", gap: 10,
                    }}>

                        <View style={{ flex: 1 }}>
                            <Text style={[g.subTitle, { fontSize: 22, marginBottom: 0 }]}>
                                <Ionicons name="lock-closed-outline" size={24} color={t.colors.text} /> Challenges are Pro only
                            </Text>
                            <Text style={[g.text]}>
                                Subscribe to keep your streak alive and unlock daily challenges
                            </Text>
                        </View>
                        <TTButton
                            onPress={() => router.push("/paywall")}
                            title="Subscribe to continue"
                            style={{ width: "100%" }}
                            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={t.colors.textOverPrimary} />}
                        >
                        </TTButton>
                    </View>
                ) : !isPro && inTrial ? (
                    <>
                        {/*<View style={{
                            backgroundColor: t.colors.primary + "18",
                            borderRadius: 12, padding: 12, borderWidth: 1,
                            borderColor: t.colors.primary + "40",
                            flexDirection: "row", alignItems: "center", gap: 10,
                        }}>
                            <Ionicons name="time-outline" size={20} color={t.colors.primary} />
                            <View style={{ flex: 1 }}>
                                <Text style={[g.subTitle, { fontSize: 13, marginBottom: 0 }]}>
                                    {daysLeftInTrial} free day{daysLeftInTrial !== 1 ? "s" : ""} remaining
                                </Text>
                                <Text style={[g.text, { fontSize: 12, opacity: 0.7 }]}>
                                    Subscribe before your trial ends to keep your streak 🔥
                                </Text>
                            </View>
                        </View>*/}
                    </>
                ) : null}

                {/* Streak + badges */}
                <View style={{
                    backgroundColor: t.colors.cardBG, borderRadius: 14,
                    padding: 16, borderWidth: 1, borderColor: t.colors.text + "18",
                }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row" }}>
                                {badgeTier ? (
                                    <Text style={{ fontSize: 24, marginRight: 8 }}>{badgeTier.emoji}</Text>
                                ) : null}
                                <Text style={[g.subTitle, { fontSize: 26, marginTop: 3 }]}>{streak.count} day streak</Text>
                            </View>
                            <Text style={[g.text, { fontSize: 14,marginTop: -5 }]}>
                                {streak.count === 0
                                    ? "Complete today's challenge to start your streak"
                                    : badgeTier
                                        ? `${badgeTier.label}! ${nextMilestone ? `${nextMilestone - streak.count} days to next badge` : "Keep going!"}`
                                        : nextMilestone
                                            ? `${nextMilestone - streak.count} day${nextMilestone - streak.count !== 1 ? "s" : ""} to Bronze 🥉`
                                            : `Keep it going with ${activePet.name}!`}
                            </Text>
                        </View>
                        {activePet.avatarUri ? (
                            <Image source={{ uri: activePet.avatarUri }} style={{ width: 80, height: 80, borderRadius: 999, marginLeft: 20 }} />
                        ) : null}
                    </View>

                    {/* Sliding numbered badge window — always 7 slots */}
                    <View style={{ flexDirection: "row", gap: 6, justifyContent: "space-between" }}>
                        {Array.from({ length: 7 }, (_, i) => {
                            const windowStart = Math.max(1, streak.count - 5);
                            const slotNumber = windowStart + i;
                            const isCompleted = slotNumber <= streak.count;
                            const isCurrent = slotNumber === streak.count && streak.count > 0;
                            const tier = isCompleted ? getBadgeTier(slotNumber) : null;
                            return (
                                <View key={i} style={{
                                    width: 36, height: 36, borderRadius: 18,
                                    alignItems: "center", justifyContent: "center",
                                    backgroundColor: isCurrent
                                        ? tier ? tier.color : t.colors.primary
                                        : isCompleted
                                            ? tier ? tier.color + "33" : t.colors.primary + "22"
                                            : t.colors.cardBG,
                                    borderWidth: 1,
                                    borderColor: isCompleted
                                        ? tier ? tier.color : t.colors.primary
                                        : t.colors.text + "22",
                                }}>
                                    {isCurrent && tier ? (
                                        <Text style={{ fontSize: 18 }}>{tier.emoji}</Text>
                                    ) : (
                                        <Text style={{
                                            fontSize: 12,
                                            fontWeight: isCurrent || isCompleted ? "700" : "400",
                                            color: isCurrent
                                                ? t.colors.textOverPrimary
                                                : isCompleted
                                                    ? tier ? tier.color : t.colors.primary
                                                    : t.colors.text,
                                            opacity: isCompleted ? 1 : 0.3,
                                        }}>
                                            {slotNumber}
                                        </Text>
                                    )}
                                </View>
                            );
                        })}
                    </View>

                    {badges.length > 0 ? (
                        <Text style={[g.text, { fontSize: 13, marginTop: 10, textAlign: "center" }]}>
                            {badges.length} total challenge{badges.length !== 1 ? "s" : ""} completed
                        </Text>
                    ) : null}
                </View>

                {/* Today's challenge */}
                {challenge ? (
                    <View style={{
                        backgroundColor: t.colors.cardBG, borderRadius: 14,
                        padding: 16, borderWidth: 1, borderColor: t.colors.text + "18",
                    }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <View style={{
                                backgroundColor: t.colors.primary + "20", borderRadius: 8,
                                paddingHorizontal: 8, paddingVertical: 3,
                            }}>
                                <Text style={{ color: t.colors.primary, fontSize: 11, fontWeight: "700" }}>
                                    TODAY'S CHALLENGE
                                </Text>
                            </View>
                            {completed ? (
                                <View style={{
                                    backgroundColor: "#22c55e20", borderRadius: 8,
                                    paddingHorizontal: 8, paddingVertical: 3,
                                }}>
                                    <Text style={{ color: "#22c55e", fontSize: 11, fontWeight: "700" }}>DONE ✓</Text>
                                </View>
                            ) : null}
                        </View>

                        <Text style={[g.subTitle, { fontSize: 22, marginBottom: 8 }]}>
                            {challenge.title}
                        </Text>
                        <Text style={[g.text, { lineHeight: 22, marginBottom: 12, opacity: 0.8 }]}>
                            {challenge.description}
                        </Text>

                        {challenge.instructions?.length > 0 ? (
                            <View style={{ gap: 6, marginBottom: 12 }}>
                                {challenge.instructions.map((step, i) => (
                                    <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                                        <Text style={[g.text, { color: t.colors.primary, fontWeight: "700", minWidth: 20 }]}>
                                            {i + 1}.
                                        </Text>
                                        <Text style={[g.text, { flex: 1, lineHeight: 20 }]}>{step}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}

                        {reaction ? (
                            <View style={{
                                backgroundColor: t.colors.primary + "15",
                                borderRadius: 12, padding: 12, marginBottom: 12,
                                borderWidth: 1, borderColor: t.colors.primary + "30",
                            }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                    {activePet.avatarUri ? (
                                        <Image source={{ uri: activePet.avatarUri }}
                                               style={{ width: 24, height: 24, borderRadius: 12 }} />
                                    ) : null}
                                    <Text style={[g.text, { fontSize: 16, fontWeight: "700", color: t.colors.primary }]}>
                                        {activePet.name} says:
                                    </Text>
                                </View>
                                <Text style={[g.text, { lineHeight: 22, fontStyle: "italic" }]}>{reaction}</Text>
                            </View>
                        ) : null}

                        {!completed ? (
                            canUse ? (
                                <TTButton
                                    title={completing ? "Reacting…" : "We did it!"}
                                    onPress={handleComplete}
                                    disabled={completing}
                                    leftIcon={completing
                                        ? <ActivityIndicator color={t.colors.textOverPrimary} />
                                        : <Ionicons name="checkmark-circle" size={18} color={t.colors.textOverPrimary} />
                                    }
                                />
                            ) : (
                               <>
                                   {/*<TTButton
                                       title="Subscribe to continue"
                                       onPress={() => router.push("/paywall")}
                                       leftIcon={<Ionicons name="lock-closed-outline" size={18} color={t.colors.textOverPrimary} />}
                                   />*/}
                               </>
                            )
                        ) : (
                            <View style={{ alignItems: "center", paddingVertical: 8 }}>
                                <Text style={[g.text, { fontSize: 13 }]}>
                                    Come back tomorrow for your next challenge
                                </Text>
                            </View>
                        )}

                       {/* {__DEV__ ? (
                            <>
                                <Pressable onPress={async () => {
                                    const fakeCount = 14;
                                    const fakeStreak = { count: fakeCount, lastCompletedDate: todayUTC(), startDate: "2026-03-01" };
                                    const fakeBadges = Array.from({ length: fakeCount }, (_, i) => ({
                                        date: todayUTC(), streakDay: i + 1,
                                    }));
                                    await saveLocalStreak(activePet.id, fakeStreak);
                                    await saveLocalBadges(activePet.id, fakeBadges);
                                    load();
                                }} style={{ padding: 10, marginTop: 8 }}>
                                    <Text style={{ color: "orange", textAlign: "center" }}>DEV: Set 14 day streak</Text>
                                </Pressable>
                                <Pressable onPress={async () => {
                                    await clearLocalChallengeData(activePet.id);
                                    load();
                                }} style={{ padding: 10 }}>
                                    <Text style={{ color: "tomato", textAlign: "center" }}>DEV: Reset all challenge data</Text>
                                </Pressable>
                            </>
                        ) : null}*/}
                    </View>
                ) : null}

            </ScrollView>
        </Screen>
    );
}