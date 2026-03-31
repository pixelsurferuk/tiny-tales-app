// src/components/ui/ChallengeClubCard.js
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

function getBadgeTier(count) {
    if (count >= 100) return { label: "Diamond", emoji: "💎" };
    if (count >= 60)  return { label: "Platinum", emoji: "⚡" };
    if (count >= 30)  return { label: "Gold", emoji: "🥇" };
    if (count >= 14)  return { label: "Silver", emoji: "🥈" };
    if (count >= 7)   return { label: "Bronze", emoji: "🥉" };
    return null;
}

import { useTTTheme, useGlobalStyles } from "../../theme/globalStyles";
import { useEntitlements } from "../../state/entitlements";
import { getPets } from "../../services/pets";
import {
    getLocalStreak, getTodayChallenge,
    getGlobalDaysLeft,
} from "../../services/challengeService";
import TTButton from "./TTButton";

export default function ChallengeClubCard({ petCount = 0, refreshKey = 0 }) {
    const t = useTTTheme();
    const g = useGlobalStyles(t);
    const { isPro, server } = useEntitlements();

    const [loading, setLoading] = useState(true);
    const [petSummaries, setPetSummaries] = useState([]); // { id, name, streak, badges, todayDone }
    const [minDaysLeft, setMinDaysLeft] = useState(7);

    const load = useCallback(async () => {
        try {
            const pets = await getPets();
            if (!pets?.length) { setLoading(false); return; }

            const summaries = await Promise.all(pets.map(async (pet) => {
                const [streak, cached] = await Promise.all([
                    getLocalStreak(pet.id),
                    getTodayChallenge(pet.id),
                ]);
                return {
                    id: pet.id,
                    name: pet.name,
                    streak: streak.count || 0,
                    todayDone: !!(cached?.completedAt),
                    trialStartedAt: cached?.trialStartedAt || null,
                };
            }));

            // trialStartedAt comes from challenge data — same source of truth as challenge.js
            const trialStartedAt = summaries.find(s => s.trialStartedAt)?.trialStartedAt
                || server?.challengeTrialStartedAt
                || null;
            setMinDaysLeft(getGlobalDaysLeft(trialStartedAt));

            setPetSummaries(summaries);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [server?.challengeTrialStartedAt]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    useEffect(() => {
        if (refreshKey > 0) load();
    }, [refreshKey, load]);

    const allDone = petSummaries.length > 0 && petSummaries.every(s => s.todayDone);
    const inTrial = minDaysLeft > 0;
    const trialOver = !isPro && !inTrial && petSummaries.length > 0;

    const border = t.colors.text + "18";

    if (loading) return null;

    return (
        <View style={{
            backgroundColor: t.colors.cardBG,
            borderRadius: 16, borderWidth: 1,
            borderColor: border, padding: 16, gap: 12,
        }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 15, marginBottom: 10 }}>
                <View style={{
                    width: 80, height: 80, borderRadius: 9999,
                    backgroundColor: t.colors.primary + "20",
                    alignItems: "center", justifyContent: "center",
                }}>
                    <Text style={{ fontSize: 30 }}>🏆</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={g.subTitle}>Pet Challenges</Text>
                    {/* Description */}
                    <Text style={g.text}>
                        {petCount === 0
                            ? "Set up a pet profile to start daily challenges and build a streak together!"
                            : trialOver
                                ? "Your free trial has ended. Subscribe to keep your streaks alive"
                                : allDone
                                    ? "Great work today! All your pets' challenges are complete. Come back tomorrow"
                                    : "Complete today's challenge with each pet to keep your streaks going."}
                    </Text>
                </View>

            </View>

            {allDone && petSummaries.length > 0 ? (
                <View style={{
                    backgroundColor: "#22c55e20", borderRadius: 8,
                    paddingHorizontal: 10, paddingVertical: 8,
                }}>
                    <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "700" }}>ALL DONE ✓</Text>
                </View>
            ) : null}



            {/* Trial pill */}
           {/* {(!isPro && inTrial && petSummaries.length > 0) ? (
                <View style={{
                    flexDirection: "row", alignItems: "center", gap: 6,
                    backgroundColor: t.colors.primary + "15",
                    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
                    alignSelf: "flex-start",
                }}>
                    <Ionicons name="time-outline" size={13} color={t.colors.primary} />
                    <Text style={{ color: t.colors.primary, fontSize: 12, fontWeight: "600" }}>
                        {minDaysLeft} free day{minDaysLeft !== 1 ? "s" : ""} remaining
                    </Text>
                </View>
            ) : null}*/}

            {/* Per-pet streak summary */}
            {petSummaries.length > 0 ? (
                <View style={{ gap: 6 }}>
                    {petSummaries.map((pet) => (
                        <Pressable
                            key={pet.id}
                            onPress={() => router.push({ pathname: "/challenge", params: { petId: pet.id } })}
                            style={{
                                flexDirection: "row", alignItems: "center",
                                gap: 10, paddingVertical: 6,
                                borderBottomWidth: 1, borderBottomColor: border,
                            }}
                        >
                            <View style={{
                                width: 45,
                                height: 45,
                                borderRadius: 999,
                                backgroundColor: t.colors.primary + "20",
                                alignItems: "center",
                                justifyContent: "center",
                            }}>
                                {Number(pet.streak) > 0 && getBadgeTier(pet.streak)?.emoji ? (
                                    <Text style={{ fontSize: 21 }}>
                                        {getBadgeTier(pet.streak)?.emoji}
                                    </Text>
                                ) : (
                                    <Ionicons name="paw" size={17} color={t.colors.primary} />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[g.subTitle, { fontSize: 18, marginBottom: -4 }]}>{pet.name}</Text>
                                <Text style={[g.text, {fontSize: 13}]}>
                                    {pet.streak > 0 ? `${pet.streak} day streak` : "No streak yet — start today!"}
                                </Text>
                            </View>
                            {pet.todayDone ? (
                                <Ionicons name="checkmark-circle" size={26} color="#22c55e" />
                            ) : (
                                <View style={{
                                    backgroundColor: t.colors.primary,
                                    borderRadius: 8, paddingHorizontal: 13, paddingVertical: 9,
                                }}>
                                    <Text style={{ color: t.colors.textOverPrimary, fontSize: 14, fontWeight: "700" }}>
                                        Go
                                    </Text>
                                </View>
                            )}
                        </Pressable>
                    ))}
                </View>
            ) : null}

            <View style={{marginTop: 10}}>
                <TTButton
                    title={petCount > 0 ? "See Your Pet Profiles" : "Set Up A Pet Profile"}
                    variant="secondary"
                    onPress={() => router.push(petCount > 0 ? "/profiles" : "/profiles/edit")}
                />
            </View>

            {/*{petCount === 0 ? (
                <TTButton
                    variant="secondary"
                    onPress={() => router.push("/profiles/edit")}
                    title="Set Up A Pet Profile"
                />
            ) : trialOver ? (
                <Pressable
                    onPress={() => router.push("/paywall")}
                    style={{
                        backgroundColor: t.colors.primary, borderRadius: 10,
                        paddingVertical: 12, flexDirection: "row",
                        justifyContent: "center", alignItems: "center", gap: 8,
                    }}
                >
                    <Ionicons name="rocket" size={16} color={t.colors.textOverPrimary} />
                    <Text style={{ color: t.colors.textOverPrimary, fontWeight: "700" }}>
                        Go Pro to Continue
                    </Text>
                </Pressable>
            ) : null}*/}
        </View>
    );
}