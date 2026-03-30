// src/ads/useAdGate.js
import { useCallback, useState } from "react";
import { showRewardedAd } from "./rewarded";
import { getAppIdentity } from "../services/identity";
import { API } from "../services/ai";
import { REWARDED_ADS_ENABLED } from "../config";
import { useEntitlements } from "../state/entitlements";
import { useAuth } from "../state/auth";

const MAX_ADS_PER_DAY = 3;

export function useAdGate({ onCreditsGranted, onLimitReached } = {}) {
    const { deviceId, isPro, refreshAll, setCreditsLocal } = useEntitlements();
    const { userId } = useAuth();
    const [isWatchingAd, setIsWatchingAd] = useState(false);
    const [adsToday, setAdsToday] = useState(0);

    const tryWatchAd = useCallback(async () => {
        if (!REWARDED_ADS_ENABLED || isPro) {
            onLimitReached?.();
            return;
        }
        if (isWatchingAd) return;

        setIsWatchingAd(true);
        try {
            const identity = await getAppIdentity();
            const identityId = userId ? `user:${userId}` : identity?.id ?? deviceId ?? null;
            if (!identityId) { onLimitReached?.(); return; }

            // Check daily limit BEFORE loading the ad
            try {
                const statusRes = await fetch(`${API}/ads/status`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identityId }),
                });
                const contentType = statusRes.headers.get("content-type") || "";
                if (contentType.includes("application/json")) {
                    const statusJson = await statusRes.json();
                    if (statusJson.limitReached) {
                        onLimitReached?.();
                        return;
                    }
                }
                // If non-JSON response (e.g. HTML error page) — assume limit not reached and proceed
            } catch (statusErr) {
                console.warn("[adGate] status check failed, proceeding with ad", statusErr?.message);
            }

            // Limit not reached — show the ad
            await new Promise((resolve, reject) => {
                showRewardedAd({
                    ssvUserId: identityId,
                    ssvCustomData: JSON.stringify({ source: "adGate", ts: Date.now() }),
                    onRewardEarned: async () => {
                        try {
                            const res = await fetch(`${API}/ads/reward-credit`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ identityId, source: "adGate" }),
                            });
                            const json = await res.json();

                            if (json.ok) {
                                setAdsToday(json.adsToday ?? 0);
                                setCreditsLocal(json);
                                await refreshAll({ reason: "ad_gate_credit", retries: 2, delayMs: 400 });
                                onCreditsGranted?.(json);
                                resolve();
                            } else if (json.error === "DAILY_AD_LIMIT_REACHED") {
                                setAdsToday(MAX_ADS_PER_DAY);
                                onLimitReached?.();
                                resolve();
                            } else {
                                reject(new Error(json.error || "Failed to grant credits"));
                            }
                        } catch (err) { reject(err); }
                    },
                    onClosed: ({ rewardEarned }) => {
                        if (!rewardEarned) {
                            // User dismissed ad without watching — resolve silently, don't go to paywall
                            resolve();
                        }
                    },
                    onError: (err) => reject(err),
                });
            });
        } catch (e) {
            const msg = String(e?.message || e);
            const isNoFill = msg.includes("no-fill") || msg.includes("no fill");
            const isNetworkErr = msg.includes("network") || msg.includes("timeout");

            if (isNoFill || isNetworkErr) {
                // No ad available or network issue — go to paywall as fallback
                onLimitReached?.();
            }
            // All other errors (e.g. unknown) — fail silently, don't punish user with paywall
            if (!isNoFill && !isNetworkErr) {
                console.warn("[adGate]", msg);
            }
        } finally {
            setIsWatchingAd(false);
        }
    }, [isWatchingAd, isPro, userId, deviceId, refreshAll, setCreditsLocal, onCreditsGranted, onLimitReached]);

    return { tryWatchAd, isWatchingAd, adsToday };
}