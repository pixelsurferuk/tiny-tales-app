import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, Linking, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Purchases, { PURCHASE_TYPE } from "react-native-purchases";

import Screen from "../src/components/ui/Screen";
import TTButton from "../src/components/ui/TTButton";
import { useTTTheme } from "../src/theme";
import { useEntitlements } from "../src/state/entitlements";
import { useAuth } from "../src/state/auth";
import InlineLoginGate from "../src/components/auth/InlineLoginGate";
import { showRewardedAd } from "../src/ads/rewarded";
import { getAppIdentity } from "../src/services/identity";
import { API } from "../src/services/ai";
import {
    CREDIT_PRODUCTS,
    SUBSCRIPTIONS_ENABLED,
    REWARDED_ADS_ENABLED,
} from "../src/config";

function getSourceCopy(source) {
    if (source === "chat") {
        return {
            title: "Out of credits",
            subtitle: "Buy more credits to keep chatting with your pet.",
        };
    }
    if (source === "thoughts") {
        return {
            title: "Out of credits",
            subtitle: "Top up your credits to generate more thoughts.",
        };
    }
    return {
        title: "Get more Tiny Tales credits",
        subtitle: "Buy credits for thoughts and chat.",
    };
}

export default function Paywall() {
    const params = useLocalSearchParams();
    const source = typeof params?.source === "string" ? params.source : "generic";

    const t = useTTTheme();
    const styles = useMemo(() => makeStyles(t), [t]);
    const copy = getSourceCopy(source);

    const { server, isPro, refreshAll, rcReady, setCreditsLocal } = useEntitlements();
    const { email, userId, isLoggedIn, ready: authReady } = useAuth();

    const [loadingProducts, setLoadingProducts] = useState(false);
    const [loadingOffer, setLoadingOffer] = useState(false);
    const [buyingId, setBuyingId] = useState(null);
    const [purchasingSub, setPurchasingSub] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [watchingAd, setWatchingAd] = useState(false);
    const [storeProducts, setStoreProducts] = useState({});
    const [monthlyPkg, setMonthlyPkg] = useState(null);
    const [priceText, setPriceText] = useState("");
    const [rewardStatusText, setRewardStatusText] = useState("");

    const creditsRemaining =
        typeof server?.creditsRemaining === "number" ? server.creditsRemaining : null;

    const goBackSafe = useCallback(() => {
        try {
            if (router.canGoBack?.()) {
                router.back();
            } else {
                router.replace("/");
            }
        } catch {
            router.replace("/");
        }
    }, []);

    const loadProducts = useCallback(async () => {
        setLoadingProducts(true);
        try {
            const prods = await Purchases.getProducts(
                CREDIT_PRODUCTS.map((p) => p.id),
                PURCHASE_TYPE.INAPP
            );
            const map = {};
            for (const p of prods || []) map[p.identifier] = p;
            setStoreProducts(map);
        } catch (e) {
            console.warn("[RevenueCat] getProducts failed:", e?.message || e);
            setStoreProducts({});
        } finally {
            setLoadingProducts(false);
        }
    }, []);

    const loadOffering = useCallback(async () => {
        setLoadingOffer(true);
        try {
            const offerings = await Purchases.getOfferings();
            const offering = offerings?.current || null;
            const pkg =
                offering?.availablePackages?.find((p) => p?.identifier === "$rc_monthly") ||
                offering?.availablePackages?.find((p) => p?.packageType === "MONTHLY") ||
                offering?.availablePackages?.[0] ||
                null;
            setMonthlyPkg(pkg);
            setPriceText(pkg?.product?.priceString || pkg?.product?.localizedPriceString || "");
        } catch (e) {
            console.warn("[RevenueCat] getOfferings failed:", e?.message || e);
            setMonthlyPkg(null);
            setPriceText("");
        } finally {
            setLoadingOffer(false);
        }
    }, []);

    useEffect(() => {
        if (!authReady || !isLoggedIn || !rcReady) return;
        loadProducts();
        if (SUBSCRIPTIONS_ENABLED) loadOffering();
    }, [authReady, isLoggedIn, rcReady, loadProducts, loadOffering]);

    // Refresh credits when user logs in so balance shown is accurate
    useEffect(() => {
        if (!isLoggedIn) return;
        const id = setTimeout(() => {
            refreshAll({ reason: "paywall_login", retries: 2, delayMs: 400 });
        }, 300);
        return () => clearTimeout(id);
    }, [isLoggedIn, refreshAll]);

    const close = useCallback(async () => {
        await refreshAll({ reason: "paywall_close", retries: 1, delayMs: 350 });
        goBackSafe();
    }, [refreshAll, goBackSafe]);

    const handleManageSubscription = useCallback(() => {
        const url = Platform.OS === "ios"
            ? "https://apps.apple.com/account/subscriptions"
            : "https://play.google.com/store/account/subscriptions";
        Linking.openURL(url).catch(() =>
            Alert.alert("Couldn't open store", "Please manage your subscription in the App Store or Google Play.")
        );
    }, []);

    const handleWatchAd = useCallback(async () => {
        if (buyingId || purchasingSub || restoring || watchingAd) return;

        setWatchingAd(true);
        setRewardStatusText("");

        try {
            const identity = await getAppIdentity();
            const identityId = userId ? `user:${userId}` : identity?.id ?? null;

            if (!identityId) throw new Error("Missing identityId for rewarded ad credit");

            const customData = JSON.stringify({ source: "paywall", ts: Date.now() });

            await new Promise((resolve, reject) => {
                showRewardedAd({
                    ssvUserId: identityId,
                    ssvCustomData: customData,
                    onRewardEarned: async () => {
                        try {
                            setRewardStatusText("Reward earned. Adding credit…");
                            const res = await fetch(`${API}/ads/reward-credit`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ identityId, source: "paywall", amount: 1 }),
                            });
                            const json = await res.json();
                            if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to add credit");
                            await refreshAll({ reason: "rewarded_ad_credit", retries: 3, delayMs: 500 });
                            setRewardStatusText("1 credit added ✅");
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    },
                    onClosed: ({ rewardEarned }) => {
                        if (!rewardEarned) reject(new Error("Ad closed before reward was earned"));
                    },
                    onError: (err) => reject(err),
                });
            });
        } catch (e) {
            const msg = String(e?.message || e);
            if (
                !msg.toLowerCase().includes("closed before reward") &&
                !msg.toLowerCase().includes("no-fill") &&
                !msg.toLowerCase().includes("no fill")
            ) {
                Alert.alert("Ad unavailable", msg);
            }
            setRewardStatusText("");
        } finally {
            setWatchingAd(false);
        }
    }, [buyingId, purchasingSub, restoring, watchingAd, refreshAll, userId]);

    const buyCredits = useCallback(
        async (productId) => {
            if (!rcReady) { Alert.alert("Store not ready", "Please wait a moment and try again."); return; }
            const product = storeProducts?.[productId];
            if (!product) { Alert.alert("Not ready", "Still loading store details. Try again in a moment."); return; }
            if (buyingId || purchasingSub || restoring || watchingAd) return;

            setBuyingId(productId);
            try {
                await Purchases.purchaseStoreProduct(product);
                const fast = await refreshAll({ reason: "paywall_purchase_fast", retries: 1, delayMs: 450 });
                // Apply credits to context immediately so ask.js sees them on return
                if (fast?.status) setCreditsLocal(fast.status);
                await refreshAll({ reason: "paywall_purchase_confirm", retries: 3, delayMs: 650 });
                if(__DEV__) Alert.alert("Credits added ✅", "Your balance has been topped up.");
                goBackSafe();
            } catch (e) {
                const msg = String(e?.message || e);
                const cancelled = String(e?.code || "").toLowerCase().includes("cancel") || msg.toLowerCase().includes("cancel");
                if (!cancelled) Alert.alert("Purchase failed", msg);
            } finally {
                setBuyingId(null);
            }
        },
        [rcReady, storeProducts, buyingId, purchasingSub, restoring, watchingAd, refreshAll, setCreditsLocal, goBackSafe]
    );

    const handleSubscribe = useCallback(async () => {
        if (!rcReady) { Alert.alert("Store not ready", "Please wait a moment and try again."); return; }
        if (!monthlyPkg) { Alert.alert("Not ready", "Still loading store details. Try again in a moment."); return; }
        if (buyingId || purchasingSub || restoring || watchingAd) return;

        setPurchasingSub(true);
        try {
            await Purchases.purchasePackage(monthlyPkg);
            await refreshAll({ reason: "sub_purchase_fast", retries: 1, delayMs: 450 });
            await refreshAll({ reason: "sub_purchase_confirm", retries: 2, delayMs: 650 });
            if(__DEV__) Alert.alert("Unlocked ✅", "Tiny Tales Pro is active.");
            goBackSafe();
        } catch (e) {
            const msg = String(e?.message || e);
            const cancelled = String(e?.code || "").toLowerCase().includes("cancel") || msg.toLowerCase().includes("cancel");
            if (!cancelled) Alert.alert("Purchase failed", msg);
        } finally {
            setPurchasingSub(false);
        }
    }, [rcReady, monthlyPkg, buyingId, purchasingSub, restoring, watchingAd, refreshAll, goBackSafe]);

    const handleRestore = useCallback(async () => {
        if (!rcReady) { Alert.alert("Store not ready", "Please wait a moment and try again."); return; }
        if (buyingId || purchasingSub || restoring || watchingAd) return;

        setRestoring(true);
        try {
            await Purchases.restorePurchases();
            await refreshAll({ reason: "sub_restore", retries: 2, delayMs: 650 });
            Alert.alert("Restored ✅", "Any active subscription or previous credit pack should be back now.");
            goBackSafe();
        } catch (e) {
            Alert.alert("Restore failed", String(e?.message || e));
        } finally {
            setRestoring(false);
        }
    }, [rcReady, buyingId, purchasingSub, restoring, watchingAd, refreshAll, goBackSafe]);

    if (!authReady) {
        return (
            <Screen style={styles.container}>
                <View style={styles.center}><ActivityIndicator /></View>
            </Screen>
        );
    }

    return (
        <>
            <StatusBar style={t.isDark ? "light" : "dark"} />
            <Screen style={styles.container} edges={["top", "bottom"]}>
                {!isLoggedIn ? (
                    <InlineLoginGate
                        title="Sign in to unlock purchases"
                        subtitle="Sign in to buy credits, start Pro, and keep everything safe across devices."
                        cancelTo="/"
                    />
                ) : (
                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                    >
                        <View style={styles.topRow}>
                            <View style={styles.topTextWrap}>
                                <Text style={styles.title}>{copy.title}</Text>
                                {!!email && <Text style={styles.emailText}>{email}</Text>}
                            </View>
                            <Pressable style={styles.closeBtn} onPress={close}>
                                <Ionicons name="close" size={20} color={t.colors.text} />
                            </Pressable>
                        </View>

                        <View style={styles.balancePill}>
                            <Ionicons name="sparkles" size={14} color={t.colors.text}  />
                            {creditsRemaining === null && !isPro ? (
                                <>
                                    <ActivityIndicator size="small" color={t.colors.text} style={{ transform: [{ scale: 0.75 }] }} />
                                    <Text style={styles.balanceText}>Checking credits…</Text>
                                </>
                            ) : (
                                <Text style={styles.balanceText}>
                                    {isPro ? "Pro active" : `${creditsRemaining} credits left`}
                                </Text>
                            )}
                        </View>

                        {SUBSCRIPTIONS_ENABLED && (
                            <View style={styles.proCard}>
                                <View style={styles.proHeaderRow}>
                                    <Text style={styles.proTitle}>Tiny Tales Pro</Text>
                                    <View style={styles.proBadge}>
                                        <Text style={styles.proBadgeText}>Best value</Text>
                                    </View>
                                </View>
                                <Text style={styles.proSubtitle}>Unlimited thoughts, chat, and no ads.</Text>
                                <View style={styles.benefitsRow}>
                                    <Benefit icon="chatbubbles" text="Unlimited chat" />
                                    <Benefit icon="bulb" text="Unlimited thoughts" />
                                    <Benefit icon="shield-checkmark" text="No ads" />
                                </View>
                                <TTButton
                                    title={
                                        loadingOffer || purchasingSub
                                            ? "Starting Pro…"
                                            : `Start Pro${priceText ? ` (${priceText} PCM)` : ""}`
                                    }
                                    onPress={handleSubscribe}
                                    disabled={
                                        isPro || !rcReady || loadingOffer || purchasingSub ||
                                        !monthlyPkg || !!buyingId || restoring || watchingAd
                                    }
                                    loading={false}
                                    leftIcon={<Ionicons name="rocket" size={16} color={t.colors.textOverPrimary} />}
                                />
                                {isPro && (
                                    <Pressable onPress={handleManageSubscription} style={styles.manageSubBtn}>
                                        <Text style={styles.manageSubText}>Manage or cancel subscription</Text>
                                    </Pressable>
                                )}
                            </View>
                        )}

                        {REWARDED_ADS_ENABLED && !isPro && (
                            <View style={styles.freeCard}>
                                <View style={styles.freeCardLeft}>
                                    <View style={styles.freeIconWrap}>
                                        <Ionicons name="play-circle" size={20} color={t.colors.textOverPrimary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.freeTitle}>Get 1 free credit</Text>
                                        <Text style={styles.freeSubtitle}>Watch a short video to earn a free credit.</Text>
                                    </View>
                                </View>
                                <Pressable
                                    onPress={handleWatchAd}
                                    disabled={watchingAd || !!buyingId || purchasingSub || restoring}
                                    style={({ pressed }) => [
                                        styles.freeButton,
                                        pressed && !(watchingAd || !!buyingId || purchasingSub || restoring) && {
                                            opacity: 0.9,
                                            transform: [{ scale: 0.98 }],
                                        },
                                        (watchingAd || !!buyingId || purchasingSub || restoring) && { opacity: 0.6 },
                                    ]}
                                >
                                    {watchingAd ? (
                                        <ActivityIndicator color={t.colors.textOverPrimary} />
                                    ) : (
                                        <Text style={styles.freeButtonText}>Watch ad</Text>
                                    )}
                                </Pressable>
                                {!!rewardStatusText && (
                                    <Text style={styles.rewardStatusText}>{rewardStatusText}</Text>
                                )}
                            </View>
                        )}

                        {!isPro && (
                            loadingProducts ? (
                                <View style={styles.loadingWrap}>
                                    <ActivityIndicator />
                                </View>
                            ) : (
                                <>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionTitle}>Credit packs</Text>
                                        <Text style={styles.sectionSub}>1 credit per pet thought or chat reply</Text>
                                    </View>
                                    <View style={styles.grid}>
                                        {CREDIT_PRODUCTS.map((item) => {
                                            const product = storeProducts?.[item.id];
                                            const price = product?.priceString || product?.localizedPriceString || "…";
                                            const isBusy = buyingId === item.id;
                                            const disabled = !rcReady || !product || !!buyingId || purchasingSub || restoring || watchingAd;
                                            return (
                                                <Pressable
                                                    key={item.id}
                                                    style={({ pressed }) => [
                                                        styles.packCard,
                                                        pressed && !disabled && { transform: [{ scale: 0.98 }] },
                                                        disabled && { opacity: 0.72 },
                                                    ]}
                                                    disabled={disabled}
                                                    onPress={() => buyCredits(item.id)}
                                                >
                                                    <Text style={styles.packTitle}>{item.label}</Text>
                                                    <Text style={styles.packBlurb}>{item.blurb}</Text>
                                                    <View style={styles.buyPill}>
                                                        {isBusy ? <ActivityIndicator color="#1B1F2A" /> : <Text style={styles.buyText}>{price}</Text>}
                                                    </View>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </>
                            )
                        )}
                    </ScrollView>
                )}
            </Screen>
        </>
    );
}

function Benefit({ icon, text }) {
    const t = useTTTheme();
    return (
        <View style={stylesBenefit.row}>
            <Ionicons name={icon} size={15} color={t.colors.primary} />
            <Text style={[stylesBenefit.text, { color: t.colors.text }]} numberOfLines={1}>{text}</Text>
        </View>
    );
}

const stylesBenefit = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 5 },
    text: { fontSize: 13, fontWeight: "600" },
});

const makeStyles = (t) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: t.colors.bg },
        center: { flex: 1, alignItems: "center", justifyContent: "center" },
        content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, flexGrow: 1, gap: 12 },
        topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
        topTextWrap: { flex: 1, gap: 2, marginTop: 20, marginBottom: 10 },
        closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
        title: { fontSize: 24, fontWeight: "800", color: t.colors.text, lineHeight: 28 },
        emailText: { color: t.colors.textMuted || t.colors.text, fontSize: 13 },
        balancePill: { flexDirection: "row", gap: 6, alignItems: "center" },
        balanceText: { color: t.colors.text, fontWeight: "600", fontSize: 15 },
        proCard: {
            padding: 14, borderRadius: 18, borderWidth: 1, borderColor: t.colors.border,
            backgroundColor: t.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)", gap: 10,
        },
        proHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
        proBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: t.colors.primary },
        proBadgeText: { color: t.colors.textOverPrimary, fontWeight: "800", fontSize: 11 },
        proTitle: { color: t.colors.text, fontSize: 20, fontWeight: "800", flex: 1 },
        proSubtitle: { color: t.colors.text, opacity: 0.75, fontSize: 13, lineHeight: 18 },
        benefitsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
        manageSubBtn: { alignItems: "center", paddingVertical: 4 },
        manageSubText: { color: t.colors.text, opacity: 0.5, fontSize: 12, textDecorationLine: "underline" },
        freeCard: {
            padding: 12, borderRadius: 16, borderWidth: 1, borderColor: t.colors.border,
            backgroundColor: t.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.025)", gap: 12,
        },
        freeCardLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
        freeIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.primary, alignItems: "center", justifyContent: "center" },
        freeTitle: { color: t.colors.text, fontSize: 15, fontWeight: "800" },
        freeSubtitle: { color: t.colors.text, opacity: 0.72, fontSize: 12, marginTop: 2, lineHeight: 16 },
        freeButton: { height: 38, borderRadius: 999, backgroundColor: t.colors.primary, alignItems: "center", justifyContent: "center" },
        freeButtonText: { color: t.colors.textOverPrimary, fontWeight: "800", fontSize: 13 },
        rewardStatusText: { color: t.colors.text, opacity: 0.72, fontSize: 12, textAlign: "center", marginTop: 4 },
        sectionHeader: { gap: 2, marginTop: 2 },
        sectionTitle: { color: t.colors.text, fontSize: 22, fontWeight: "800" },
        sectionSub: { color: t.colors.text, opacity: 0.72, fontSize: 13 },
        loadingWrap: { paddingVertical: 18, alignItems: "center", justifyContent: "center" },
        grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
        packCard: {
            width: "48%", padding: 12, borderRadius: 16, borderWidth: 1, borderColor: t.colors.border,
            backgroundColor: t.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)", minHeight: 120, justifyContent: "space-between",
        },
        packTitle: { color: t.colors.text, fontWeight: "800", fontSize: 15 },
        packBlurb: { color: t.colors.text, opacity: 0.7, marginTop: 3, fontSize: 12, lineHeight: 16 },
        buyPill: {
            marginTop: 10, paddingHorizontal: 12, height: 34, borderRadius: 999,
            backgroundColor: t.colors.primary, alignItems: "center", justifyContent: "center",
            alignSelf: "flex-start", minWidth: 74,
        },
        buyText: { color: t.colors.textOverPrimary, fontWeight: "800", fontSize: 13 },
    });
