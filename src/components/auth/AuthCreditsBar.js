import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { router } from "expo-router";

import { useTTTheme, makeAuthCreditsBarStyles, useGlobalStyles } from "../../theme/globalStyles";
import { useEntitlements } from "../../state/entitlements";
import { useAuth } from "../../state/auth";
import { logout } from "../../services/auth";
import TTButton from "../ui/TTButton";
import { TEST_FORCE_ZERO_CREDITS } from "../../config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LoginGateButton from "./LoginGateButton";

export default function AuthCreditsBar({ style, compact = false, homePage = false }) {
    const t = useTTTheme();
    const styles = useMemo(() => makeAuthCreditsBarStyles(t), [t]);
    const g = useGlobalStyles(t);
    const { server, isPro, refreshAll, refreshIdentity } = useEntitlements();
    const { isLoggedIn, email } = useAuth();
    const totalCredits = server?.creditsTotal ?? 0;
    const [hasLoggedInBefore, setHasLoggedInBefore] = useState(false);
    const [busy, setBusy] = useState(false);
    const realCredits = server?.creditsRemaining ?? 0;
    const effectiveCredits = TEST_FORCE_ZERO_CREDITS ? 0 : realCredits;

    const showBar = effectiveCredits <= 0 || totalCredits > 3 || isLoggedIn;

    useEffect(() => {
        AsyncStorage.getItem("tiny_tales_has_logged_in")
            .then(val => setHasLoggedInBefore(val === "true"))
            .catch(() => {});
    }, []);

    useEffect(() => {
        (async () => {
            try {
                await refreshIdentity?.();
                await refreshAll?.({ reason: "auth_bar_auth_change", retries: 1, delayMs: 250 });
            } catch (e) {
                console.warn("[AuthCreditsBar] refresh failed", e);
            }
        })();
    }, [isLoggedIn, refreshIdentity, refreshAll]);

    const handleLogout = async () => {
        if (busy) return;
        try {
            setBusy(true);
            await logout();
            await refreshIdentity?.();
            await refreshAll?.({ reason: "logout", retries: 1, delayMs: 250 });
            router.replace("/");
        } catch (e) {
            console.warn("Logout failed", e);
        } finally {
            setBusy(false);
        }
    };

    // ─── Compact mode — slim bar for ask/preview screens ─────────────────────
    if (compact) {
        if (!server?.loaded || !showBar) return null;
        return (
            <View style={[{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 15,
                paddingVertical: 10,
                backgroundColor: t.colors.cardBG,
                borderBottomWidth: 0.5,
                borderBottomColor: t.colors.text + "22",
                ...(homePage && {marginBottom: 0}),
            }, style]}>
                <Text style={[g.text, { fontSize: 12, opacity: 0.7 }]}>
                    {isLoggedIn && email ? email : "Guest"}
                </Text>
                <Text style={[g.text, { fontSize: 12, opacity: 0.7 }]}>
                    Credits: {isPro ? "Unlimited" : effectiveCredits}
                </Text>
            </View>
        );
    }

    // ─── Full mode ────────────────────────────────────────────────────────────
    if (!server?.loaded) {
        return (
            <View style={[styles.card, styles.wrap, style]}>
                <ActivityIndicator color={t.colors.text} />
            </View>
        );
    }

    return (
        <>
            {showBar && (
                <View style={[styles.card, styles.wrap, style]}>

                    <Text style={[g.subTitle, { fontSize: 20, marginBottom: 15, textAlign: "center" }]}>
                        Watch 5 video ads and get 10 free credits daily.
                    </Text>

                    {(isLoggedIn || effectiveCredits <= 0 || totalCredits > 3) && (
                        <TTButton
                            variant="third"
                            title={isPro ? "Manage Subscription" : "Get Credits"}
                            onPress={() => router.push("/paywall")}
                        />
                    )}

                    {/*{isLoggedIn && (
                        <TTButton
                            variant="danger"
                            title={busy ? "Signing out…" : "Sign Out"}
                            onPress={handleLogout}
                            disabled={busy}
                            style={{ marginTop: 10 }}
                        />
                    )}*/}

                </View>
            )}
        </>
    );
}