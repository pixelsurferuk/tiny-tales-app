import React, { useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Pressable,
    ActivityIndicator,
    Alert,
} from "react-native";
import { router } from "expo-router";

import { useTTTheme } from "../../theme";
import { sendLoginCode, verifyLoginCode, getAccessToken } from "../../services/auth";
import { useAuth } from "../../state/auth";
import { useEntitlements } from "../../state/entitlements";
import { API } from "../../services/ai";

export default function InlineLoginGate({
                                            title = "Sign in to continue",
                                            subtitle = "Sign in to unlock purchases and keep them safe across devices.",
                                            cancelTo = "/",
                                            onSuccess,
                                        }) {
    const t = useTTTheme();
    const styles = useMemo(() => makeStyles(t), [t]);

    const { refreshAuth } = useAuth();
    const { refreshIdentity, refreshAll } = useEntitlements();

    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);

    const applyLoginBonus = async () => {
        try {
            const identity = await refreshIdentity();
            const accessToken = await getAccessToken().catch(() => null);

            if (!accessToken) return;

            await fetch(`${API}/auth/login-bonus`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    identityId: identity?.id,
                }),
            });
        } catch (e) {
            console.warn("[login-bonus] failed:", e?.message || e);
        }
    };

    const onSend = async () => {
        if (busy) return;

        const clean = String(email || "").trim();
        if (!clean || !clean.includes("@")) {
            Alert.alert("Enter your email", "Please enter a valid email address.");
            return;
        }

        setBusy(true);
        try {
            await sendLoginCode(clean);
            setSent(true);
            Alert.alert("Check your email", "We’ve sent you a sign-in code.");
        } catch (e) {
            Alert.alert("Sign-in failed", String(e?.message || e));
        } finally {
            setBusy(false);
        }
    };

    const onVerify = async () => {
        if (busy) return;

        const cleanEmail = String(email || "").trim();
        const cleanCode = String(code || "").trim();

        if (!cleanEmail || !cleanEmail.includes("@")) {
            Alert.alert("Enter your email", "Please enter the same email address.");
            return;
        }

        if (!cleanCode || cleanCode.length < 6) {
            Alert.alert("Enter your code", "Please enter the code from your email.");
            return;
        }

        setBusy(true);
        try {
            await verifyLoginCode(cleanEmail, cleanCode);

            const session = await refreshAuth();
            if (!session?.user?.id) {
                throw new Error("Sign-in completed, but no user was found.");
            }

            const identity = await refreshIdentity();
            await applyLoginBonus();

            // Pass the new identity ID explicitly — refreshAll's closure still has
            // the old guest appUserId until the next render, so we bypass it here
            await refreshAll({
                reason: "otp_login",
                retries: 2,
                delayMs: 500,
                overrideId: identity?.id,
            });

            onSuccess?.();
        } catch (e) {
            Alert.alert("Verification failed", String(e?.message || e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={styles.wrap}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.newuser}>New users get free tokens</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor={t.colors.text + "99"}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                editable={!busy}
            />

            {!sent ? (
                <Pressable style={[styles.primaryBtn, busy && { opacity: 0.7 }]} onPress={onSend} disabled={busy}>
                    {busy ? <ActivityIndicator color={t.colors.textOverPrimary} /> : <Text style={styles.primaryBtnText}>Send code</Text>}
                </Pressable>
            ) : (
                <>
                    <TextInput
                        value={code}
                        onChangeText={setCode}
                        placeholder="sign in code"
                        placeholderTextColor={t.colors.text + "99"}
                        keyboardType="number-pad"
                        style={styles.input}
                        editable={!busy}
                    />

                    <Pressable style={[styles.primaryBtn, busy && { opacity: 0.7 }]} onPress={onVerify} disabled={busy}>
                        {busy ? <ActivityIndicator color={t.colors.textOverPrimary} /> : <Text style={styles.primaryBtnText}>Verify code</Text>}
                    </Pressable>

                    <Pressable onPress={onSend} disabled={busy}>
                        <Text style={styles.linkText}>Resend code</Text>
                    </Pressable>
                </>
            )}

            <Pressable onPress={() => router.replace(cancelTo)}>
                <Text style={styles.cancelText}>Maybe later</Text>
            </Pressable>
        </View>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        wrap: {
            flex: 1,
            justifyContent: "center",
            padding: 24,
        },
        title: {
            fontSize: 28,
            fontWeight: "800",
            color: t.colors.text,
            marginBottom: 6,
        },
        newuser: {
            fontSize: 20,
            fontWeight: "600",
            color: t.colors.text,
            marginBottom: 6,
        },
        subtitle: {
            color: t.colors.text,
            opacity: 0.7,
            marginTop: 5,
            marginBottom: 30,
        },
        input: {
            borderWidth: 1,
            borderColor: t.colors.border,
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 15,
            color: t.colors.text,
            backgroundColor: t.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
            marginBottom: 12,
        },
        primaryBtn: {
            borderRadius: 16,
            paddingVertical: 15,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.colors.primary,
            marginBottom: 10,
        },
        primaryBtnText: {
            color: t.colors.textOverPrimary,
            fontWeight: "700",
            fontSize: 16,
        },
        linkText: {
            textAlign: "center",
            color: t.colors.text,
            opacity: 0.75,
            marginTop: 2,
            marginBottom: 8,
        },
        cancelText: {
            textAlign: "center",
            color: t.colors.text,
            opacity: 0.6,
            marginTop: 8,
        },
    });