import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Linking, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Purchases, { PURCHASE_TYPE } from "react-native-purchases";
import { API } from "../src/services/ai";
import Screen from "../src/components/ui/Screen";
import TTButton from "../src/components/ui/TTButton";
import WatchAdButton from "../src/ads/WatchAdButton";
import { useTTTheme, useGlobalStyles, makePaywallStyles } from "../src/theme/globalStyles";
import { useEntitlements } from "../src/state/entitlements";
import { useAuth } from "../src/state/auth";
import InlineLoginGate from "../src/components/auth/InlineLoginGate";
import { CREDIT_PRODUCTS, SUBSCRIPTIONS_ENABLED, REWARDED_ADS_ENABLED } from "../src/config";
import { useTTAlert } from "../src/components/ui/TTAlert";


function getSourceCopy(source) {
    if (source === "chat") return { title: "Out of credits", subtitle: "Buy more credits to keep chatting with your pet." };
    if (source === "thoughts") return { title: "Out of credits", subtitle: "Top up your credits to generate more thoughts." };
    return { title: "Get More From Tiny Tales", subtitle: "Buy credits for thoughts and chats." };
}

function Benefit({ icon, text, styles }) {
    const t = useTTTheme();
    return (
        <View style={styles.benefitRow}>
            <Ionicons name={icon} size={15} color={t.colors.primary} />
            <Text style={[styles.benefitText, { color: t.colors.text }]} numberOfLines={1}>{text}</Text>
        </View>
    );
}

export default function Paywall() {
    const params = useLocalSearchParams();
    const source = typeof params?.source === "string" ? params.source : "generic";
    const from = typeof params?.from === "string" ? params.from : null;

    const t = useTTTheme();
    const g = useGlobalStyles(t);
    const styles = useMemo(() => makePaywallStyles(t), [t]);
    const copy = getSourceCopy(source);

    const { server, isPro, refreshAll, rcReady, setCreditsLocal } = useEntitlements();
    const { email, userId, isLoggedIn, ready: authReady } = useAuth();

    const [loadingProducts, setLoadingProducts] = useState(false);
    const [loadingOffer, setLoadingOffer] = useState(false);
    const [buyingId, setBuyingId] = useState(null);
    const [purchasingSub, setPurchasingSub] = useState(false);
    const [storeProducts, setStoreProducts] = useState({});
    const [monthlyPkg, setMonthlyPkg] = useState(null);
    const [priceText, setPriceText] = useState("");
    const [showLoginGate, setShowLoginGate] = useState(false);
    const [adLimitReached, setAdLimitReached] = useState(false);

    const pendingActionRef = useRef(null);

    const creditsRemaining = typeof server?.creditsRemaining === "number" ? server.creditsRemaining : null;
    const anyBusy = !!buyingId || purchasingSub;

    const alert = useTTAlert();

    const goBackSafe = useCallback(() => {
        try {
            if (from) {
                router.replace(from);
                return;
            }

            const routeMap = {
                chat: "/ask",
                thoughts: "/",
                profiles: "/profiles",
            };

            router.replace(routeMap[source] || "/");
        } catch {
            router.replace("/");
        }
    }, [source, from]);

    const requireLogin = useCallback((onSuccess) => {
        if (isLoggedIn) { onSuccess(); return; }
        pendingActionRef.current = onSuccess;
        setShowLoginGate(true);
    }, [isLoggedIn]);

    const loadProducts = useCallback(async () => {
        setLoadingProducts(true);
        try {
            const prods = await Purchases.getProducts(CREDIT_PRODUCTS.map((p) => p.id), PURCHASE_TYPE.INAPP);
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
                offering?.availablePackages?.[0] || null;
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

    const { deviceId } = useEntitlements();

    const [adSectionReady, setAdSectionReady] = useState(false);

    useEffect(() => {
        if (isPro || !deviceId) { setAdSectionReady(true); return; }
        fetch(`${API}/ads/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identityId: deviceId }),
        })
            .then(r => r.json())
            .then(json => {
                if (json.limitReached) setAdLimitReached(true);
            })
            .catch(() => {})
            .finally(() => setAdSectionReady(true)); // ← only ready after check
    }, [isPro, deviceId]);

    useEffect(() => {
        if (!authReady || !rcReady) return;
        loadProducts();
        if (SUBSCRIPTIONS_ENABLED) loadOffering();
    }, [authReady, rcReady, loadProducts, loadOffering]);

    useEffect(() => {
        if (!isLoggedIn) return;
        const id = setTimeout(() => { refreshAll({ reason: "paywall_login", retries: 2, delayMs: 400 }); }, 300);
        return () => clearTimeout(id);
    }, [isLoggedIn, refreshAll]);

    useEffect(() => {
        if (isLoggedIn) setShowLoginGate(false);
    }, [isLoggedIn]);

    const close = useCallback(async () => {
        await refreshAll({ reason: "paywall_close", retries: 1, delayMs: 350 });
        goBackSafe();
    }, [refreshAll, goBackSafe]);

    const handleManageSubscription = useCallback(() => {
        const url = Platform.OS === "ios"
            ? "https://apps.apple.com/account/subscriptions"
            : "https://play.google.com/store/account/subscriptions";
        Linking.openURL(url).catch(() =>
            alert("Couldn't open store", "Please manage your subscription in the App Store or Google Play.")
        );
    }, []);

    const autoWatchAdFiredRef = useRef(false);

    useEffect(() => {
        if (params?.autoWatchAd !== "true") return;
        if (!isLoggedIn || !rcReady) return;
        if (autoWatchAdFiredRef.current) return;
        autoWatchAdFiredRef.current = true;
    }, [params?.autoWatchAd, isLoggedIn, rcReady]);

    const buyCredits = useCallback(async (productId) => {
        if (!rcReady) { alert("Store not ready", "Please wait a moment and try again."); return; }
        const product = storeProducts?.[productId];
        if (!product) { alert("Not ready", "Still loading store details. Try again in a moment."); return; }
        if (anyBusy) return;

        setBuyingId(productId);
        try {
            await Purchases.purchaseStoreProduct(product);
            const fast = await refreshAll({ reason: "paywall_purchase_fast", retries: 1, delayMs: 450 });
            if (fast?.status) setCreditsLocal(fast.status);
            await refreshAll({ reason: "paywall_purchase_confirm", retries: 3, delayMs: 650 });
            alert("Credits added ✅", "Your balance has been topped up.", [
                { text: "OK", onPress: goBackSafe }
            ]);
        } catch (e) {
            const msg = String(e?.message || e);
            const cancelled = String(e?.code || "").toLowerCase().includes("cancel") || msg.toLowerCase().includes("cancel");
            if (!cancelled) alert("Purchase failed", msg);
        } finally {
            setBuyingId(null);
        }
    }, [rcReady, storeProducts, anyBusy, refreshAll, setCreditsLocal, goBackSafe]);

    const handleSubscribe = useCallback(async () => {
        if (!rcReady) { alert("Store not ready", "Please wait a moment and try again."); return; }
        if (!monthlyPkg) { alert("Not ready", "Still loading store details. Try again in a moment."); return; }
        if (anyBusy) return;

        setPurchasingSub(true);
        try {
            await Purchases.purchasePackage(monthlyPkg);
            await refreshAll({ reason: "sub_purchase_fast", retries: 1, delayMs: 450 });
            await refreshAll({ reason: "sub_purchase_confirm", retries: 2, delayMs: 650 });
            alert("Unlocked ✅", "Tiny Tales Pro is active.", [
                { text: "OK", onPress: goBackSafe }
            ]);
        } catch (e) {
            const msg = String(e?.message || e);
            const cancelled = String(e?.code || "").toLowerCase().includes("cancel") || msg.toLowerCase().includes("cancel");
            if (!cancelled) alert("Purchase failed", msg);
        } finally {
            setPurchasingSub(false);
        }
    }, [rcReady, monthlyPkg, anyBusy, refreshAll, goBackSafe]);

    if (!authReady) {
        return (
            <Screen style={styles.container}>
                <View style={g.center}><ActivityIndicator /></View>
            </Screen>
        );
    }

    if (showLoginGate) {
        return (
            <Screen style={styles.container} edges={["top", "bottom"]}>
                <StatusBar style={t.isDark ? "light" : "dark"} />
                <InlineLoginGate
                    title="Sign in to continue"
                    subtitle="Sign in to buy credits, start Pro, and keep your balance safe across devices."
                    cancelTo={null}
                    onSuccess={() => {
                        setShowLoginGate(false);
                        if (pendingActionRef.current) {
                            setTimeout(() => {
                                pendingActionRef.current?.();
                                pendingActionRef.current = null;
                            }, 500);
                        }
                    }}
                    onCancel={() => {
                        setShowLoginGate(false);
                        pendingActionRef.current = null;
                    }}
                />
            </Screen>
        );
    }

    return (
        <>
            <StatusBar style={t.isDark ? "light" : "dark"} />
            <Screen style={styles.container} edges={["top", "bottom"]}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
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
                        <Ionicons name="sparkles" size={14} color={t.colors.text} />
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

                    {/* Ad section — shows limit message or watch ad button */}
                    {!isPro && (
                        !adSectionReady ? (
                            <View style={[styles.freeCard, { alignItems: "center", justifyContent: "center" }]}>
                                <ActivityIndicator color={t.colors.text} />
                            </View>
                        ) : adLimitReached ? (
                            <View style={[styles.freeCard, { flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }]}>
                                <Text style={[styles.freeTitle, { textAlign: "center" }]}>Daily free credit limit reached</Text>
                                <Text style={[styles.freeSubtitle, { textAlign: "center"}]}>
                                    You've watched all your ads for today. Come back tomorrow for more free credits!
                                </Text>
                            </View>
                        ) : (
                            <WatchAdButton
                                disabled={anyBusy}
                                onLimitReached={() => setAdLimitReached(true)}
                                onCreditAdded={() => refreshAll({ reason: "paywall_ad" })}
                            />
                        )
                    )}

                    {SUBSCRIPTIONS_ENABLED && (
                        <View style={styles.proCard}>
                            <View style={styles.proHeaderRow}>
                                <Text style={styles.proTitle}>Tiny Tales Pro</Text>

                            </View>
                            {/*<Text style={styles.proSubtitle}>Unlimited credits and no ads.</Text>*/}
                            <View style={styles.benefitsRow}>
                                <Benefit icon="sparkles" text="Unlimited Credits" styles={styles} />
                                <Benefit icon="trophy" text="Pet Challenges" styles={styles} />
                                <Benefit icon="shield-checkmark" text="No ads" styles={styles} />
                            </View>
                            <TTButton
                                title={loadingOffer || purchasingSub ? "Starting Pro…" : `Start Pro${priceText ? ` (${priceText} PCM)` : ""}`}
                                onPress={() => requireLogin(handleSubscribe)}
                                disabled={isPro || loadingOffer || purchasingSub || anyBusy || (isLoggedIn && (!rcReady || !monthlyPkg))}
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

                    {!isPro && (
                        loadingProducts ? (
                            <View style={styles.loadingWrap}><ActivityIndicator /></View>
                        ) : (
                            <>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Credit Packs</Text>
                                    <Text style={styles.sectionSub}>1 credit per pet thought or chat reply</Text>
                                </View>
                                <View style={styles.grid}>
                                    {CREDIT_PRODUCTS.map((item) => {
                                        const product = storeProducts?.[item.id];
                                        const price = product?.priceString || product?.localizedPriceString || "…";
                                        const isBusy = buyingId === item.id;
                                        const disabled = (!isLoggedIn ? false : !rcReady) || !product || anyBusy;
                                        return (
                                            <Pressable
                                                key={item.id}
                                                style={({ pressed }) => [
                                                    styles.packCard,
                                                    pressed && !disabled && { transform: [{ scale: 0.98 }] },
                                                    disabled && { opacity: 0.72 },
                                                ]}
                                                disabled={disabled}
                                                onPress={() => requireLogin(() => buyCredits(item.id))}
                                            >
                                                <Text style={styles.packTitle}>{item.label}</Text>
                                                <Text style={styles.packBlurb}>{item.blurb}</Text>
                                                <View style={styles.buyPill}>
                                                    {isBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buyText}>{price}</Text>}
                                                </View>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </>
                        )
                    )}
                </ScrollView>
            </Screen>
        </>
    );
}