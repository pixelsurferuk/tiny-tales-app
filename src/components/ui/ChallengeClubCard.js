// src/components/ui/ChallengeClubCard.js
import React, { useCallback, useState } from "react";
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
    getLocalStreak, getLocalBadges, getTodayChallenge,
    getGlobalDaysLeft,
} from "../../services/challengeService";

export default function ChallengeClubCard({ petCount = 0 }) {
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

            // Server date wins — prevents trial reset on login
            const globalDays = getGlobalDaysLeft(server?.challengeTrialStartedAt || null);
            setMinDaysLeft(globalDays);

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
                };
            }));

            setPetSummaries(summaries);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [server?.challengeTrialStartedAt]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const allDone = petSummaries.length > 0 && petSummaries.every(s => s.todayDone);
    const anyAvailable = petSummaries.some(s => !s.todayDone);
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: t.colors.primary + "20",
                    alignItems: "center", justifyContent: "center",
                }}>
                    <Text style={{ fontSize: 20 }}>🏆</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[g.subTitle, { fontSize: 16 }]}>Pet Challenge Club</Text>
                    <Text style={[g.text, { fontSize: 12, opacity: 0.6 }]}>
                        Daily challenges to bond with your pet
                    </Text>
                </View>
                {allDone && petSummaries.length > 0 ? (
                    <View style={{
                        backgroundColor: "#22c55e20", borderRadius: 8,
                        paddingHorizontal: 8, paddingVertical: 4,
                    }}>
                        <Text style={{ color: "#22c55e", fontSize: 11, fontWeight: "700" }}>ALL DONE ✓</Text>
                    </View>
                ) : null}
            </View>

            {/* Description */}
            <Text style={[g.text, { lineHeight: 20, opacity: 0.8 }]}>
                {petCount === 0
                    ? "Set up a pet profile to start daily challenges and build a streak together!"
                    : trialOver
                        ? "Your free trial has ended. Subscribe to keep your streaks alive 🔥"
                        : allDone
                            ? "Great work today! All your pets' challenges are complete. Come back tomorrow 🐾"
                            : "Complete today's challenge with each pet to keep your streaks going."}
            </Text>

            {/* Trial pill */}
            {(!isPro && inTrial && petSummaries.length > 0) ? (
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
            ) : null}

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
                                width: 28, height: 28, borderRadius: 14,
                                backgroundColor: pet.streak > 0 ? t.colors.primary + "20" : t.colors.text + "10",
                                alignItems: "center", justifyContent: "center",
                            }}>
                                <Ionicons name="paw" size={14} color={pet.streak > 0 ? t.colors.primary : t.colors.text} style={{ opacity: pet.streak > 0 ? 1 : 0.3 }} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[g.text, { fontSize: 13, fontWeight: "600" }]}>{pet.name}</Text>
                                <Text style={[g.text, { fontSize: 11, opacity: 0.6 }]}>
                                    {pet.streak > 0
                                        ? `${getBadgeTier(pet.streak)?.emoji || "🐾"} ${pet.streak} day streak`
                                        : "No streak yet — start today!"}
                                </Text>
                            </View>
                            {pet.todayDone ? (
                                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                            ) : (
                                <View style={{
                                    backgroundColor: t.colors.primary,
                                    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
                                }}>
                                    <Text style={{ color: t.colors.textOverPrimary, fontSize: 11, fontWeight: "700" }}>
                                        GO
                                    </Text>
                                </View>
                            )}
                        </Pressable>
                    ))}
                </View>
            ) : null}
            {petCount === 0 ? (
                <Pressable
                    onPress={() => router.push("/profiles/edit")}
                    style={{
                        backgroundColor: t.colors.primary, borderRadius: 10,
                        paddingVertical: 12, alignItems: "center",
                    }}
                >
                    <Text style={{ color: t.colors.textOverPrimary, fontWeight: "700" }}>
                        Set Up A Pet Profile
                    </Text>
                </Pressable>
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
            ) : null}
        </View>
    );
}