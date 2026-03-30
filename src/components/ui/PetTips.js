// src/components/ui/PetTips.js
import React, { useState, useCallback, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTTTheme, useGlobalStyles } from "../../theme/globalStyles";
import { API } from "../../services/ai";
import { useEntitlements } from "../../state/entitlements";

const TABS = [
    { key: "training", label: "Training Tip", icon: "ribbon-outline" },
    { key: "activity", label: "Brain Game", icon: "bulb-outline" },
];

const POOL_SIZE = 20;

function getAgeRangeFromLabel(ageLabel) {
    if (!ageLabel) return "adult";
    const lower = ageLabel.toLowerCase();
    const monthMatch = lower.match(/^(\d+)\s*month/);
    const yearMatch = lower.match(/^(\d+)\s*year/);
    if (monthMatch) {
        const m = parseInt(monthMatch[1]);
        return m < 6 ? "baby" : "young";
    }
    if (yearMatch) {
        const y = parseInt(yearMatch[1]);
        if (y < 2) return "young";
        if (y < 7) return "adult";
        return "senior";
    }
    return "adult";
}

function getSeenKey(petId, tipType) {
    return `tiny_tales_seen_tips_${petId}_${tipType}`;
}

function getPoolKey(petType, ageRange, tipType) {
    return `tiny_tales_pool_${petType}_${ageRange}_${tipType}`;
}

export default function PetTips({ pet, onBeforeGenerate }) {
    const t = useTTTheme();
    const g = useGlobalStyles(t);
    const { deviceId, setCreditsLocal } = useEntitlements();

    const [activeTab, setActiveTab] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pool, setPool] = useState([]);
    const [seenIds, setSeenIds] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [hasLoaded, setHasLoaded] = useState(false); // has user hit Get Tip yet

    const ageRange = getAgeRangeFromLabel(pet?.age);
    const petType = pet?.petType || "pet";

    const loadPoolAndSeen = useCallback(async (tipType) => {
        if (!pet?.id) return { pool: [], seen: [] };
        try {
            const [rawPool, rawSeen] = await Promise.all([
                AsyncStorage.getItem(getPoolKey(petType, ageRange, tipType)),
                AsyncStorage.getItem(getSeenKey(pet.id, tipType)),
            ]);
            return {
                pool: rawPool ? JSON.parse(rawPool) : [],
                seen: rawSeen ? JSON.parse(rawSeen) : [],
            };
        } catch {
            return { pool: [], seen: [] };
        }
    }, [pet?.id, petType, ageRange]);

    const savePool = useCallback(async (tipType, poolData) => {
        await AsyncStorage.setItem(getPoolKey(petType, ageRange, tipType), JSON.stringify(poolData));
    }, [petType, ageRange]);

    const saveSeen = useCallback(async (tipType, seenData) => {
        if (!pet?.id) return;
        await AsyncStorage.setItem(getSeenKey(pet.id, tipType), JSON.stringify(seenData));
    }, [pet?.id]);

    const fetchPool = useCallback(async (tipType, existingPool, forceCredit = false) => {
        const existingTitles = existingPool.map(t => t.title);
        const needed = POOL_SIZE - existingPool.length;

        const res = await fetch(`${API}/pet/tips/pool`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                identityId: deviceId,
                petType,
                ageRange,
                tipType,
                needed: Math.max(0, needed),
                existingTitles,
                forceCredit,
            }),
        });

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) throw new Error("Server error");
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Failed to fetch pool");

        if (typeof json.creditsRemaining === "number") {
            setCreditsLocal({ creditsRemaining: json.creditsRemaining });
        }

        const existingIds = new Set(existingPool.map(t => t.id));
        const fresh = (json.tips || []).filter(t => !existingIds.has(t.id));
        const newPool = [...existingPool, ...fresh];
        if (fresh.length > 0) await savePool(tipType, newPool);
        return newPool;
    }, [deviceId, petType, ageRange, savePool, setCreditsLocal]);

    // Open tab — free, no credit check, just load local state
    const handleTabPress = useCallback(async (key) => {
        if (activeTab === key) {
            // Close if already open
            setActiveTab(null);
            setPool([]);
            setSeenIds([]);
            setHasLoaded(false);
            setError(null);
            return;
        }

        setActiveTab(key);
        setPool([]);
        setSeenIds([]);
        setCurrentIndex(0);
        setHasLoaded(false);
        setError(null);

        // Load local state silently — no server call, no credit
        try {
            const { pool: loadedPool, seen: loadedSeen } = await loadPoolAndSeen(key);

            if (loadedSeen.length > 0 && loadedPool.length === 0) {
                // Seen IDs restored from sync but pool cache is empty (not synced).
                // Silently refetch pool from server — no credit, no prompt.
                // They already paid for these tips.
                setLoading(true);
                try {
                    const restoredPool = await fetchPool(key, [], false);
                    setPool(restoredPool);
                    setSeenIds(loadedSeen);
                    setCurrentIndex(Math.max(0, loadedSeen.length - 1));
                    setHasLoaded(true);
                } catch {
                    // Server unavailable — show Get Tip so they can retry
                    setHasLoaded(false);
                } finally {
                    setLoading(false);
                }
            } else {
                if (loadedPool.length > 0) setPool(loadedPool);
                if (loadedSeen.length > 0) {
                    setSeenIds(loadedSeen);
                    setCurrentIndex(Math.max(0, loadedSeen.length - 1));
                    setHasLoaded(true);
                }
            }
        } catch {
            // ignore — will show Get Tip button
        }
    }, [activeTab, loadPoolAndSeen]);

    // Get Tip / Next Tip — this is where credit is spent
    const handleGetTip = useCallback(() => {
        if (!activeTab) return;

        const go = async () => {
            setLoading(true);
            setError(null);
            try {
                const { pool: loadedPool, seen: loadedSeen } = await loadPoolAndSeen(activeTab);

                // Always hit server — this is where the credit is spent
                const finalPool = await fetchPool(activeTab, loadedPool, true);

                const unseenTips = finalPool.filter(t => !loadedSeen.includes(t.id));

                if (unseenTips.length > 0) {
                    const nextTip = unseenTips[0];
                    const newSeen = [...loadedSeen, nextTip.id];
                    setPool(finalPool);
                    setSeenIds(newSeen);
                    setCurrentIndex(newSeen.length - 1);
                    setHasLoaded(true);
                    await saveSeen(activeTab, newSeen);
                } else {
                    // All seen
                    setPool(finalPool);
                    setSeenIds(loadedSeen);
                    setHasLoaded(true);
                }
            } catch (e) {
                console.warn("[PetTips] handleGetTip error", e?.message);
                setError("Couldn't load tips right now. Try again!");
            } finally {
                setLoading(false);
            }
        };

        if (onBeforeGenerate) {
            onBeforeGenerate(activeTab, go, () => {});
        } else {
            go();
        }
    }, [activeTab, loadPoolAndSeen, fetchPool, saveSeen, onBeforeGenerate]);

    const handleClose = useCallback(() => {
        setActiveTab(null);
        setPool([]);
        setSeenIds([]);
        setHasLoaded(false);
        setError(null);
    }, []);

    const visibleTips = pool.filter(t => seenIds.includes(t.id));
    const currentTip = visibleTips[currentIndex] || null;
    const allSeen = pool.length >= POOL_SIZE && seenIds.length >= POOL_SIZE;
    const hasMore = !allSeen && (
        pool.filter(t => !seenIds.includes(t.id)).length > 0 ||
        pool.length < POOL_SIZE
    );

    const currentTabData = TABS.find(tab => tab.key === activeTab);
    const cardBg = t.colors.cardBG;
    const border = t.colors.text + "18";

    return (
        <View style={{ marginTop: 8 }}>
            {/* Tab row — free to open, no credit check */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: activeTab ? 10 : 0 }}>
                {TABS.map((tab) => {
                    const active = activeTab === tab.key;
                    return (
                        <Pressable
                            key={tab.key}
                            onPress={() => handleTabPress(tab.key)}
                            style={{
                                flex: 1,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                paddingVertical: 9,
                                borderRadius: 10,
                                backgroundColor: active ? t.colors.primary : cardBg,
                                borderWidth: 1,
                                borderColor: active ? t.colors.primary : border,
                            }}
                        >
                            <Ionicons
                                name={tab.icon}
                                size={15}
                                color={active ? t.colors.textOverPrimary : t.colors.text}
                            />
                            <Text style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color: active ? t.colors.textOverPrimary : t.colors.text,
                            }}>
                                {tab.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Content card */}
            {activeTab && (
                <View style={{
                    backgroundColor: cardBg,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: border,
                    padding: 16,
                }}>
                    {/* Header */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <Text style={[g.text, { fontSize: 12, opacity: 0.5 }]}>
                            {visibleTips.length > 0
                                ? `${currentIndex + 1} of ${pool.length >= POOL_SIZE ? POOL_SIZE : `${visibleTips.length}+`}`
                                : ""}
                        </Text>
                        <Pressable
                            onPress={handleClose}
                            style={{
                                width: 32, height: 32, borderRadius: 999,
                                alignItems: "center", justifyContent: "center",
                                borderWidth: 1, borderColor: t.colors.text + "22",
                            }}
                            hitSlop={10}
                        >
                            <Ionicons name="close" size={16} color={t.colors.text} />
                        </Pressable>
                    </View>

                    {loading ? (
                        <View style={{ alignItems: "center", paddingVertical: 20 }}>
                            <ActivityIndicator color={t.colors.primary} />
                            <Text style={[g.text, { marginTop: 8, opacity: 0.6, fontSize: 13 }]}>
                                {activeTab === "training" ? "Loading training tips…" : "Loading brain games…"}
                            </Text>
                        </View>

                    ) : error ? (
                        <View style={{ alignItems: "center", paddingVertical: 10 }}>
                            <Text style={[g.text, { textAlign: "center", opacity: 0.6 }]}>{error}</Text>
                            <Pressable onPress={handleGetTip} style={{ marginTop: 10 }}>
                                <Text style={{ color: t.colors.primary, fontWeight: "600" }}>Try again</Text>
                            </Pressable>
                        </View>

                    ) : allSeen ? (
                        <View style={{ alignItems: "center", paddingVertical: 16 }}>
                            <Ionicons name="checkmark-circle-outline" size={32} color={t.colors.primary} style={{ marginBottom: 8 }} />
                            <Text style={[g.subTitle, { textAlign: "center", marginBottom: 6 }]}>You've seen all tips!</Text>
                            <Text style={[g.text, { textAlign: "center", opacity: 0.6, fontSize: 13 }]}>
                                Check back soon — new tips for {pet?.name || "your pet"}'s next age range are on the way 🐾
                            </Text>
                        </View>

                    ) : !hasLoaded ? (
                        // ── Get Tip CTA — shown before user has spent any credits ──
                        <View style={{ alignItems: "center", paddingVertical: 12, gap: 10 }}>
                            <Ionicons
                                name={currentTabData?.icon || "ribbon-outline"}
                                size={32}
                                color={t.colors.primary}
                                style={{ opacity: 0.7 }}
                            />
                            <Text style={[g.subTitle, { textAlign: "center", fontSize: 15 }]}>
                                {activeTab === "training"
                                    ? `Get a training tip for ${pet?.name || "your pet"}`
                                    : `Get a brain game for ${pet?.name || "your pet"}`}
                            </Text>
                            <Text style={[g.text, { textAlign: "center", opacity: 0.6, fontSize: 13 }]}>
                                {activeTab === "training"
                                    ? "Personalised tips based on your pet's type and age."
                                    : "Fun mental stimulation activities using household items."}
                            </Text>
                            <Pressable
                                onPress={handleGetTip}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 8,
                                    backgroundColor: t.colors.primary,
                                    paddingHorizontal: 20,
                                    paddingVertical: 11,
                                    borderRadius: 12,
                                    marginTop: 4,
                                }}
                            >
                                <Ionicons name={currentTabData?.icon || "ribbon-outline"} size={16} color={t.colors.textOverPrimary} />
                                <Text style={{ color: t.colors.textOverPrimary, fontWeight: "700", fontSize: 14 }}>
                                    {activeTab === "training" ? "Get Training Tip" : "Get Brain Game"}
                                </Text>
                            </Pressable>
                        </View>

                    ) : currentTip ? (
                        <View>
                            {currentTip.title && (
                                <Text style={[g.subTitle, { marginBottom: 8, fontSize: 17, paddingRight: 8 }]}>
                                    {currentTip.title}
                                </Text>
                            )}
                            {currentTip.description && (
                                <Text style={[g.text, { lineHeight: 22, marginBottom: 8 }]}>
                                    {currentTip.description}
                                </Text>
                            )}
                            {currentTip.steps && currentTip.steps.length > 0 && (
                                <View style={{ marginTop: 4 }}>
                                    {currentTip.steps.map((step, i) => (
                                        <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                                            <Text style={[g.text, { color: t.colors.primary, fontWeight: "700", minWidth: 20 }]}>
                                                {i + 1}.
                                            </Text>
                                            <Text style={[g.text, { flex: 1, lineHeight: 20 }]}>{step}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                            {currentTip.why && (
                                <View style={{
                                    marginTop: 10, padding: 10, borderRadius: 8,
                                    backgroundColor: t.colors.primary + "18",
                                }}>
                                    <Text style={[g.text, { fontSize: 12, opacity: 0.8, lineHeight: 18 }]}>
                                        💡 {currentTip.why}
                                    </Text>
                                </View>
                            )}
                            {currentTip.difficulty && (
                                <Text style={[g.text, { marginTop: 8, fontSize: 12, opacity: 0.5 }]}>
                                    Difficulty: {currentTip.difficulty}
                                </Text>
                            )}

                            {/* Navigation */}
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                                <Pressable
                                    onPress={() => setCurrentIndex(i => Math.max(0, i - 1))}
                                    disabled={currentIndex === 0}
                                    style={{ opacity: currentIndex === 0 ? 0.3 : 1, padding: 6 }}
                                    hitSlop={8}
                                >
                                    <Ionicons name="chevron-back" size={20} color={t.colors.primary} />
                                </Pressable>

                                <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
                                    {visibleTips.map((_, i) => (
                                        <Pressable key={i} onPress={() => setCurrentIndex(i)}>
                                            <View style={{
                                                width: i === currentIndex ? 16 : 6,
                                                height: 6, borderRadius: 3,
                                                backgroundColor: i === currentIndex
                                                    ? t.colors.primary
                                                    : t.colors.text + "30",
                                            }} />
                                        </Pressable>
                                    ))}
                                    {hasMore && (
                                        <View style={{
                                            width: 6, height: 6, borderRadius: 3,
                                            backgroundColor: t.colors.text + "18",
                                            borderWidth: 1, borderColor: t.colors.text + "30",
                                        }} />
                                    )}
                                </View>

                                {currentIndex < visibleTips.length - 1 ? (
                                    <Pressable
                                        onPress={() => setCurrentIndex(i => i + 1)}
                                        style={{ padding: 6 }}
                                        hitSlop={8}
                                    >
                                        <Ionicons name="chevron-forward" size={20} color={t.colors.primary} />
                                    </Pressable>
                                ) : hasMore ? (
                                    <Pressable
                                        onPress={handleGetTip}
                                        disabled={loading}
                                        style={{
                                            flexDirection: "row", alignItems: "center", gap: 4,
                                            backgroundColor: t.colors.primary,
                                            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                                        }}
                                        hitSlop={8}
                                    >
                                        <Text style={{ color: t.colors.textOverPrimary, fontWeight: "600", fontSize: 12 }}>
                                            Next tip
                                        </Text>
                                        <Ionicons name="arrow-forward" size={13} color={t.colors.textOverPrimary} />
                                    </Pressable>
                                ) : (
                                    <View style={{ width: 32 }} />
                                )}
                            </View>
                        </View>
                    ) : null}
                </View>
            )}
        </View>
    );
}