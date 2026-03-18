import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";

import { useTTTheme } from "../../theme";
import { useEntitlements } from "../../state/entitlements";
import { useAuth } from "../../state/auth";
import { logout } from "../../services/auth";
import TTButton from "../../../src/components/ui/TTButton";
import { TEST_FORCE_ZERO_CREDITS } from "../../config";

export default function AuthCreditsBar({ style }) {
    const t = useTTTheme();
    const styles = useMemo(() => makeStyles(t), [t]);

    const { server, isPro, refreshAll, refreshIdentity } = useEntitlements();
    const { isLoggedIn, email } = useAuth();
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                await refreshIdentity?.();
                await refreshAll?.({ reason: "auth_bar_auth_change", retries: 1, delayMs: 250 });
            } catch (e) {
                console.warn("[AuthCreditsBar] refresh after auth change failed", e);
            }
        })();
    }, [isLoggedIn, refreshIdentity, refreshAll]);

    // Show spinner while the first status fetch hasn't completed
    if (!server?.loaded) {
        return (
            <View style={[styles.wrap, style]}>
                <ActivityIndicator color={t.colors.text} />
            </View>
        );
    }

    const realCredits = server?.creditsRemaining ?? 0;
    const effectiveCredits = TEST_FORCE_ZERO_CREDITS ? 0 : realCredits;
    const showPaywallButton = isLoggedIn && !isPro && effectiveCredits <= 0;

    const handlePress = async () => {
        if (busy) return;

        if (isLoggedIn) {
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
            return;
        }

        router.push("/paywall");
    };

    return (
        <View style={[styles.wrap, style]}>
            <TTButton
                variant={isLoggedIn ? "danger" : "success"}
                title={busy ? "..." : isLoggedIn ? "Logout" : "Login/Create Account"}
                onPress={handlePress}
                disabled={busy}
                style={({ pressed }) => [
                    styles.button,
                    busy && { opacity: 0.6 },
                    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                ]}
            />

            {showPaywallButton && (
                <TTButton
                    variant="success"
                    title="Buy Credits"
                    onPress={() => router.push("/paywall")}
                    style={({ pressed }) => [
                        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                    ]}
                />
            )}

            {isLoggedIn && (
                <Text style={styles.creditsText}>
                    Credits: {isPro ? "Unlimited" : effectiveCredits}
                </Text>
            )}

            {isLoggedIn && !!email && (
                <Text style={styles.emailText}>{email}</Text>
            )}
        </View>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        wrap: {
            flexDirection: "column",
            gap: 12,
        },
        emailText: {
            textAlign: "center",
            color: t.colors.textMuted || t.colors.text,
            fontSize: 14,
        },
        creditsText: {
            textAlign: "center",
            color: t.colors.text,
            fontSize: 15,
            fontWeight: "700",
        },
    });
