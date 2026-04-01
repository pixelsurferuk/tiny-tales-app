// src/ads/WatchAdButton.js
import React, { useCallback, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTTTheme, useGlobalStyles, makePaywallStyles } from "../theme/globalStyles";
import { showRewardedAd } from "./rewarded";
import { getAppIdentity } from "../services/identity";
import { API } from "../services/ai";
import { REWARDED_ADS_ENABLED } from "../config";
import { useEntitlements } from "../state/entitlements";
import { useAuth } from "../state/auth";
import { useTTAlert } from "../components/ui/TTAlert";
import TTButton from "../components/ui/TTButton";

export default function WatchAdButton({ disabled = false, compact = false, style, onCreditAdded, onLimitReached }) {
    const t = useTTTheme();
    const g = useGlobalStyles(t);
    const styles = makePaywallStyles(t);

    const { isPro, refreshAll } = useEntitlements();
    const { userId } = useAuth();
    const alert = useTTAlert();

    const [watchingAd, setWatchingAd] = useState(false);
    const [rewardStatusText, setRewardStatusText] = useState("");

    const handleWatchAd = useCallback(async () => {
        if (watchingAd || disabled) return;
        setWatchingAd(true);
        setRewardStatusText("");
        try {
            const identity = await getAppIdentity();
            const identityId = userId ? `user:${userId}` : identity?.id ?? null;
            if (!identityId) throw new Error("Missing identityId for rewarded ad credit");

            const customData = JSON.stringify({ source: "watchAdButton", ts: Date.now() });

            await new Promise((resolve, reject) => {
                showRewardedAd({
                    ssvUserId: identityId,
                    ssvCustomData: customData,
                    onRewardEarned: async () => {
                        try {
                            setRewardStatusText("Reward earned. Adding credits…");
                            const res = await fetch(`${API}/ads/reward-credit`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ identityId, source: "watchAdButton" }),
                            });
                            const json = await res.json();

                            if (json.error === "DAILY_AD_LIMIT_REACHED") {
                                onLimitReached?.();
                                resolve();
                                return;
                            }

                            if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to add credits");

                            await refreshAll({ reason: "rewarded_ad_credit", retries: 3, delayMs: 500 });
                            setRewardStatusText("Credits added ✅");
                            onCreditAdded?.(json);
                            resolve();
                        } catch (err) { reject(err); }
                    },
                    onClosed: ({ rewardEarned }) => {
                        if (!rewardEarned) reject(new Error("Ad closed before reward was earned"));
                    },
                    onError: (err) => reject(err),
                });
            });
        } catch (e) {
            const msg = String(e?.message || e);
            if (!msg.toLowerCase().includes("closed before reward") &&
                !msg.toLowerCase().includes("no-fill") &&
                !msg.toLowerCase().includes("no fill")) {
                alert("Ad unavailable", msg);
            }
            setRewardStatusText("");
        } finally {
            setWatchingAd(false);
        }
    }, [watchingAd, disabled, userId, refreshAll, onCreditAdded, onLimitReached]);

    if (!REWARDED_ADS_ENABLED || isPro) return null;

    if (compact) {
        return (
            <TTButton
                title={watchingAd ? "Loading ad…" : "Free Credits"}
                variant="secondary"
                loading={watchingAd}
                onPress={handleWatchAd}
                disabled={watchingAd || disabled}
                style={{ flex: 1 }}
            />
        );
    }

    return (
        <View style={[styles.freeCard, style]}>
            <View style={styles.freeCardLeft}>
                <View style={styles.freeIconWrap}>
                    <Ionicons name="play-circle" size={26} color={t.colors.textOverThird} />
                </View>
                <View style={g.flex}>
                    <Text style={styles.freeTitle}>Get 2 free credits</Text>
                    <Text style={styles.freeSubtitle}>Watch a short video to earn 2 free credits.</Text>
                </View>
            </View>
            <Pressable
                onPress={handleWatchAd}
                disabled={watchingAd || disabled}
                style={({ pressed }) => [
                    styles.freeButton,
                    pressed && !watchingAd && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    (watchingAd || disabled) && { opacity: 0.6 },
                ]}
            >
                {watchingAd ? (
                    <ActivityIndicator color={t.colors.textOverPrimary} />
                ) : (
                    <Text style={styles.freeButtonText}>Watch ad</Text>
                )}
            </Pressable>
            {!!rewardStatusText && <Text style={styles.rewardStatusText}>{rewardStatusText}</Text>}
        </View>
    );
}