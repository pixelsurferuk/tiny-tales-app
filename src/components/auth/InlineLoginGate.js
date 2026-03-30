import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";

import { useTTTheme, makeInlineLoginGateStyles } from "../../theme/globalStyles";
import { sendLoginCode, verifyLoginCode, getAccessToken } from "../../services/auth";
import { getStableGuestId } from "../../services/guestId";
import { useAuth } from "../../state/auth";
import { useEntitlements } from "../../state/entitlements";
import { API } from "../../services/ai";
import { useTTAlert } from "../../../src/components/ui/TTAlert";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { pullSync } from "../../../src/services/syncService";

export default function InlineLoginGate({
                                            title = "Sign in to continue",
                                            subtitle = "Sign in to unlock purchases and keep them safe across devices.",
                                            cancelTo = "/",
                                            onSuccess,
                                            onCancel,     // ← add this
                                        }) {
    const t = useTTTheme();
    const styles = useMemo(() => makeInlineLoginGateStyles(t), [t]);

    const { refreshAuth } = useAuth();
    const { refreshIdentity, refreshAll } = useEntitlements();

    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const alert = useTTAlert();

    const applyLoginBonus = async (identityId) => {
        try {
            const accessToken = await getAccessToken().catch(() => null);
            if (!accessToken) return;
            await fetch(`${API}/auth/login-bonus`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ identityId }),
            });
        } catch (e) {
            console.warn("[login-bonus] failed:", e?.message || e);
        }
    };

    const transferGuestCredits = async (userId) => {
        try {
            const guestId = await getStableGuestId();
            if(__DEV__) console.log("[transfer-credits] guestId:", guestId, "userId:", userId);
            if (!guestId || !userId) {
                if(__DEV__) console.log("[transfer-credits] skipped — missing id");
                return;
            }
            const res = await fetch(`${API}/auth/transfer-credits`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ guestId, userId: `user:${userId}` }),
            });
            const json = await res.json();
            if(__DEV__) console.log("[transfer-credits] result:", json);
        } catch (e) {
            if(__DEV__) console.warn("[transfer-credits] failed:", e?.message || e);
        }
    };

    const onSend = async () => {
        if (busy) return;
        const clean = String(email || "").trim();
        if (!clean || !clean.includes("@")) {
            alert("Enter your email", "Please enter a valid email address.");
            return;
        }
        setBusy(true);
        try {
            await sendLoginCode(clean);
            setSent(true);
            alert("Check your email", "We've sent you a sign-in code.");
        } catch (e) {
            alert("Sign-in failed", String(e?.message || e));
        } finally {
            setBusy(false);
        }
    };

    const onVerify = async () => {
        if (busy) return;
        const cleanEmail = String(email || "").trim();
        const cleanCode = String(code || "").trim();
        if (!cleanEmail || !cleanEmail.includes("@")) {
            alert("Enter your email", "Please enter the same email address.");
            return;
        }
        if (!cleanCode || cleanCode.length < 6) {
            alert("Enter your code", "Please enter the code from your email.");
            return;
        }
        setBusy(true);
        try {
            await verifyLoginCode(cleanEmail, cleanCode);
            const session = await refreshAuth();
            if (!session?.user?.id) throw new Error("Sign-in completed, but no user was found.");
            ///await applyLoginBonus(identity?.id);
            await transferGuestCredits(session.user.id);

            const identity = await refreshIdentity();
            await refreshAll({ reason: "otp_login", retries: 2, delayMs: 500, overrideId: identity?.id });
            await AsyncStorage.setItem("tiny_tales_has_logged_in", "true");
            await pullSync(identity?.id);
            onSuccess?.();

        } catch (e) {
            alert("Verification failed", String(e?.message || e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={styles.wrap}>
            <Text style={styles.title}>{title}</Text>
            {/*<Text style={styles.newuser}>New users get free tokens</Text>*/}
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
                        placeholder="Sign in code"
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

            <Pressable onPress={() => onCancel ? onCancel() : (cancelTo ? router.replace(cancelTo) : null)}>
                <Text style={styles.cancelText}>Maybe later</Text>
            </Pressable>
        </View>
    );
}