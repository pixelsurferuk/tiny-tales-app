import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, View, ActivityIndicator } from "react-native";
import Purchases from "react-native-purchases";

import { getAppIdentity } from "../services/identity";
import { getServerStatus } from "../services/ai";
import { parseCreditsFromResponse } from "../utils/credits";
import { SUBSCRIPTIONS_ENABLED, RC_ENTITLEMENT_ID, TEST_FORCE_NOT_PRO } from "../config";

const ENTITLEMENT_ID = RC_ENTITLEMENT_ID;
const EntitlementsContext = createContext(null);

// Singleton RevenueCat state — prevents double-configure across re-renders
const RC_G = globalThis;
if (!RC_G.__TT_RC__) {
    RC_G.__TT_RC__ = { configured: false, userId: null, listenerAttached: false };
}

function isEntitled(customerInfo) {
    try {
        return !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
    } catch {
        return false;
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeServerStatus(s) {
    const { creditsRemaining, creditsTotal, creditsUsed } = parseCreditsFromResponse(s);
    return {
        loaded: true,
        isPro: SUBSCRIPTIONS_ENABLED ? !!s?.isPro : false,
        creditsRemaining,
        creditsTotal,
        creditsUsed,
        raw: s || null,
    };
}

const DEFAULT_SERVER_STATE = {
    loaded: false,
    isPro: false,
    creditsRemaining: null,
    creditsTotal: null,
    creditsUsed: null,
    raw: null,
};

export function EntitlementsProvider({ children }) {
    const [ready, setReady] = useState(false);
    const [appUserId, setAppUserId] = useState(null);
    const [identityType, setIdentityType] = useState("guest");
    const [rcReady, setRcReady] = useState(false);
    const [rcIsPro, setRcIsPro] = useState(false);
    const [server, setServer] = useState(DEFAULT_SERVER_STATE);

    const refreshingRef = useRef(false);
    const rawIsPro = SUBSCRIPTIONS_ENABLED ? rcIsPro || !!server.isPro : false;
    const isPro = TEST_FORCE_NOT_PRO ? false : rawIsPro;

    const applyServerStatus = useCallback((s) => {
        setServer(normalizeServerStatus(s));
    }, []);

    const refreshFromServer = useCallback(
        async ({ retries = 0, delayMs = 500, reason = "manual", overrideId } = {}) => {
            const id = overrideId || appUserId;
            if (!id) return null;

            let latest = null;
            const first = await getServerStatus(id).catch(() => null);
            if (first) {
                latest = first;
                applyServerStatus(first);
            }

            const retryForPro = rcIsPro && !latest?.isPro;
            const retryForCredits =
                reason.includes("credits_purchase") ||
                reason.includes("paywall_purchase") ||
                reason.includes("shared_credits");

            if ((retryForPro || retryForCredits) && retries > 0) {
                for (let i = 0; i < retries; i++) {
                    await sleep(delayMs);
                    const next = await getServerStatus(id).catch(() => null);
                    if (!next) continue;
                    latest = next;
                    applyServerStatus(next);
                    if (retryForPro && next?.isPro) break;
                    if (retryForCredits && parseCreditsFromResponse(next).creditsRemaining !== null) break;
                }
            }

            return latest;
        },
        [appUserId, rcIsPro, applyServerStatus]
    );

    const refreshFromRevenueCat = useCallback(async () => {
        if (!RC_G.__TT_RC__.configured) return null;
        try {
            const info = await Purchases.getCustomerInfo();
            setRcIsPro(SUBSCRIPTIONS_ENABLED ? isEntitled(info) : false);
            return info;
        } catch {
            // Silently fail — expected in Expo Go / environments without native RC
            return null;
        }
    }, []);

    const refreshAll = useCallback(
        async ({ reason = "manual", retries, delayMs, overrideId } = {}) => {
            const id = overrideId || appUserId;
            if (!id || refreshingRef.current) return null;

            refreshingRef.current = true;
            try {
                const info = await refreshFromRevenueCat();

                const isSubReason =
                    reason === "purchase" ||
                    reason === "restore" ||
                    reason === "rc_entitled" ||
                    reason.includes("sub_purchase") ||
                    reason.includes("sub_restore");
                const isCreditReason =
                    reason.includes("credits_purchase") || reason.includes("paywall_purchase");

                const fallbackRetries =
                    typeof retries === "number" ? retries : isSubReason ? 10 : isCreditReason ? 3 : 0;
                const fallbackDelay = typeof delayMs === "number" ? delayMs : 500;

                const status = await refreshFromServer({
                    retries: fallbackRetries,
                    delayMs: fallbackDelay,
                    reason,
                    overrideId: id,
                });

                return { info, status };
            } finally {
                refreshingRef.current = false;
            }
        },
        [appUserId, refreshFromRevenueCat, refreshFromServer]
    );

    const refreshIdentity = useCallback(async () => {
        const identity = await getAppIdentity();
        const { id } = identity;

        setAppUserId(id);
        setIdentityType(identity.type);

        const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_PUBLIC_KEY;
        if (!apiKey) {
            console.warn("⚠️ Missing EXPO_PUBLIC_REVENUECAT_PUBLIC_KEY");
            return identity;
        }

        if (!RC_G.__TT_RC__.configured) {
            // Mark configured FIRST — if configure() throws (e.g. Expo Go), we don't
            // want every subsequent call to retry and spam the same error.
            RC_G.__TT_RC__.configured = true;
            RC_G.__TT_RC__.userId = id;
            try {
                Purchases.setLogLevel(Purchases.LOG_LEVEL.INFO);
                Purchases.configure({ apiKey, appUserID: id });
            } catch (e) {
                // Expected in Expo Go — native store unavailable. RC features disabled.
                console.warn("[RevenueCat] configure failed (Expo Go?):", e?.message || e);
                return identity;
            }
        } else if (RC_G.__TT_RC__.userId !== id) {
            try {
                await Purchases.logIn(id);
            } catch (e) {
                console.warn("[RevenueCat] logIn failed:", e?.message || e);
            }
            RC_G.__TT_RC__.userId = id;
        }

        if (!RC_G.__TT_RC__.listenerAttached) {
            Purchases.addCustomerInfoUpdateListener((info) => {
                const entitled = SUBSCRIPTIONS_ENABLED ? isEntitled(info) : false;
                setRcIsPro(entitled);
                refreshFromServer({
                    retries: entitled ? 10 : 0,
                    delayMs: 650,
                    reason: entitled ? "rc_entitled" : "rc_not_entitled",
                });
            });
            RC_G.__TT_RC__.listenerAttached = true;
        }

        setRcReady(true);
        return identity;
    }, [refreshFromServer]);

    const setCreditsLocal = useCallback((patch) => {
        setServer((prev) => {
            const { creditsRemaining, creditsTotal, creditsUsed } = parseCreditsFromResponse(patch);
            return {
                ...prev,
                creditsRemaining: creditsRemaining ?? prev.creditsRemaining,
                creditsTotal: creditsTotal ?? prev.creditsTotal,
                creditsUsed: creditsUsed ?? prev.creditsUsed,
            };
        });
    }, []);

    const consumeCreditLocally = useCallback(() => {
        if (isPro) return;
        setServer((prev) => {
            if (typeof prev.creditsRemaining !== "number") return prev;
            return {
                ...prev,
                creditsRemaining: Math.max(0, prev.creditsRemaining - 1),
                creditsUsed: typeof prev.creditsUsed === "number" ? prev.creditsUsed + 1 : prev.creditsUsed,
            };
        });
    }, [isPro]);

    // Boot
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const identity = await refreshIdentity();
                if (!alive) return;
                await refreshAll({ reason: "boot", retries: 1, delayMs: 400, overrideId: identity?.id });
            } catch (e) {
                console.error("[Entitlements] init error", e);
            } finally {
                if (alive) setReady(true);
            }
        })();
        return () => { alive = false; };
    }, [refreshIdentity, refreshAll]);

    // Refresh on app foreground
    useEffect(() => {
        const sub = AppState.addEventListener("change", (state) => {
            if (state === "active" && appUserId) {
                refreshAll({ reason: "resume", retries: 1, delayMs: 350 });
            }
        });
        return () => sub.remove();
    }, [appUserId, refreshAll]);

    const value = useMemo(
        () => ({
            ready,
            rcReady,
            deviceId: appUserId,
            appUserId,
            identityType,
            isPro,
            rcIsPro,
            server,
            refreshAll,
            refreshFromServer,
            refreshFromRevenueCat,
            refreshIdentity,
            consumeCreditLocally,
            setCreditsLocal,
        }),
        [ready, rcReady, appUserId, identityType, isPro, rcIsPro, server,
            refreshAll, refreshFromServer, refreshFromRevenueCat, refreshIdentity,
            consumeCreditLocally, setCreditsLocal]
    );

    if (!ready) {
        return (
            <View style={{ flex: 1, backgroundColor: "#0B1020", alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" color="#ffffff" />
            </View>
        );
    }

    return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements() {
    const ctx = useContext(EntitlementsContext);
    if (!ctx) throw new Error("useEntitlements must be used within <EntitlementsProvider>");
    return ctx;
}