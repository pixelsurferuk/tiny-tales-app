import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { router } from "expo-router";

import { useTTTheme, makeAuthCreditsBarStyles, useGlobalStyles } from "../../theme/globalStyles";
import { useEntitlements } from "../../state/entitlements";
import { useAuth } from "../../state/auth";
import { logout } from "../../services/auth";
import TTButton from "./TTButton";
import { TEST_FORCE_ZERO_CREDITS } from "../../config";
import WatchAdButton from "./WatchAdButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LoginGateButton from "../auth/LoginGateButton";

export default function AuthCreditsBar({ style }) {
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

    if (!server?.loaded) {
        return (
            <View style={[styles.wrap, style]}>
                <ActivityIndicator color={t.colors.text} />
            </View>
        );
    }

    return (
        <View style={[styles.wrap, style]}>

            {isLoggedIn && email ? (
                <View style={{ marginBottom: 15 }}>
                    <Text style={g.subTitle}>Credits: {isPro ? "Unlimited" : effectiveCredits}</Text>
                    <Text style={g.text}>{email}</Text>
                </View>
            ) : !isLoggedIn && (effectiveCredits <= 0 || totalCredits > 5) ? (
                <View style={{ marginBottom: 15 }}>
                    <Text style={g.subTitle}>Credits: {isPro ? "Unlimited" : effectiveCredits}</Text>
                </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: 10 }}>
                <TTButton
                    variant="success"
                    title={isPro ? "Manage Subscription" : "Get Credits"}
                    onPress={() => router.push("/paywall")}
                    style={{ flex: 1 }}
                />
                <WatchAdButton compact />
            </View>

            {!isLoggedIn && hasLoggedInBefore ? (
                <View style={{ marginTop: 10 }}>
                    <LoginGateButton
                        title="Sign to restore your credits"
                        variant="third"
                        gateTitle="Sign in to Tiny Tales"
                        gateSubtitle="Keep your credits and pets safe across devices."
                        onSuccess={() => refreshAll({ reason: "index_login" })}
                    />
                </View>
            ) : null}

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
    );
}