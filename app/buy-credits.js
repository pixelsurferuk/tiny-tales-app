// app/buy-credits.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Alert, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useIAP } from "expo-iap";

const API = "http://192.168.0.150:8787";

// Your Store product IDs (must exist in App Store Connect / Play Console)
const PRODUCT_IDS = ["smart_20", "smart_75", "smart_200"];

// Map products → credits for your server grant
const PRODUCT_CREDITS = {
    smart_20: 20,
    smart_75: 75,
    smart_200: 200,
};

async function setAndroidNavBarDark() {
    if (Platform.OS !== "android") return;
    try {
        const mod = await import("expo-navigation-bar");
        const Nav = mod?.default ?? mod;
        if (!Nav?.setButtonStyleAsync) return;
        await Nav.setButtonStyleAsync("light");
    } catch {}
}

async function getDeviceId() {
    const KEY = "tiny_tales_device_id";
    const existing = await SecureStore.getItemAsync(KEY);
    return existing || "dev_jamie";
}

// (TEMP) For now, we’ll consider purchase “valid” and grant credits.
// Later: replace with real receipt verification endpoint on your server.
async function grantCredits(deviceId, productId) {
    const amount = PRODUCT_CREDITS[productId] ?? 0;
    if (!amount) throw new Error("Unknown productId");

    const res = await fetch(`${API}/dev/add-credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, amount }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Grant failed");
    return json;
}

export default function BuyCredits() {
    const [deviceId, setDeviceId] = useState(null);
    const [loadingSku, setLoadingSku] = useState(null);

    const productIds = useMemo(() => PRODUCT_IDS, []);

    const {
        connected,
        products,
        fetchProducts,
        requestPurchase,
        finishTransaction,
    } = useIAP({
        onPurchaseSuccess: async (purchase) => {
            try {
                // Figure out which product was bought
                // expo-iap normalizes, but IDs can appear in different fields.
                const productId =
                    purchase?.productId ||
                    purchase?.sku ||
                    purchase?.id;

                if (!productId) throw new Error("Missing product id from purchase");

                if (!deviceId) throw new Error("Missing device id");

                // ✅ Grant credits (TEMP). Replace with verified flow later.
                await grantCredits(deviceId, productId);

                // ✅ Finish transaction (consumable credits)
                await finishTransaction({ purchase, isConsumable: true });

                Alert.alert("Added ✅", "Smart Thoughts have been topped up.");
                router.back();
            } catch (e) {
                Alert.alert("Purchase received, but not granted", String(e?.message || e));
            } finally {
                setLoadingSku(null);
            }
        },
        onPurchaseError: (error) => {
            setLoadingSku(null);
            Alert.alert("Purchase cancelled", error?.message || "No worries.");
        },
    });

    useEffect(() => {
        setAndroidNavBarDark();
    }, []);

    useEffect(() => {
        (async () => setDeviceId(await getDeviceId()))();
    }, []);

    useEffect(() => {
        if (!connected) return;
        // type: 'in-app' for consumables/non-consumables
        fetchProducts({ skus: productIds, type: "in-app" }).catch((e) => {
            Alert.alert(
                "Store not ready",
                "If products are empty, check Play Console / App Store Connect setup + testing track."
            );
            console.warn(e);
        });
    }, [connected, fetchProducts, productIds]);

    const startPurchase = useCallback(
        async (productId) => {
            if (!connected) {
                Alert.alert("Store not connected yet", "Try again in a moment.");
                return;
            }
            setLoadingSku(productId);
            try {
                await requestPurchase({
                    request: {
                        apple: { sku: productId },
                        google: { skus: [productId] },
                    },
                });
            } catch (e) {
                setLoadingSku(null);
                Alert.alert("Couldn’t start purchase", String(e?.message || e));
            }
        },
        [connected, requestPurchase]
    );

    const byId = new Map(products.map((p) => [p.id, p]));

    return (
        <>
            <StatusBar style="light" />
            <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} edges={["top", "bottom"]}>
                <View style={styles.wrap}>
                    <Text style={styles.title}>Buy Smart Thoughts ⭐</Text>
                    <Text style={styles.sub}>
                        Smart Thoughts use extra scene detail to craft a richer, more “how dare you” inner monologue.
                    </Text>

                    <Text style={styles.small}>
                        Store: {connected ? "Connected" : "Connecting…"}
                    </Text>

                    {PRODUCT_IDS.map((id) => {
                        const p = byId.get(id);
                        const price = p?.displayPrice || p?.price || "";
                        const isLoading = loadingSku === id;

                        return (
                            <View style={styles.card} key={id}>
                                <Text style={styles.packTitle}>{id.replace("smart_", "").trim()} Pack</Text>
                                <Text style={styles.packSub}>+{PRODUCT_CREDITS[id]} Smart Thoughts {price ? `• ${price}` : ""}</Text>

                                <Pressable
                                    style={[styles.btn, (!connected || isLoading) && styles.btnDisabled]}
                                    onPress={() => startPurchase(id)}
                                    disabled={!connected || isLoading}
                                >
                                    <Text style={styles.btnText}>{isLoading ? "Opening store…" : "Buy"}</Text>
                                </Pressable>
                            </View>
                        );
                    })}

                    <Pressable style={styles.back} onPress={() => router.back()}>
                        <Text style={styles.backText}>Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: "#000", padding: 16, gap: 12 },
    title: { color: "#fff", fontSize: 22, fontWeight: "900" },
    sub: { color: "rgba(255,255,255,0.7)", lineHeight: 18 },
    small: { color: "rgba(255,255,255,0.5)", marginTop: 4 },

    card: {
        borderRadius: 16,
        padding: 14,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        gap: 8,
    },
    packTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
    packSub: { color: "rgba(255,255,255,0.75)" },

    btn: {
        marginTop: 6,
        paddingVertical: 12,
        borderRadius: 14,
        alignItems: "center",
        backgroundColor: "#f59e0b",
    },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: "#000", fontWeight: "900" },

    back: {
        marginTop: 8,
        paddingVertical: 12,
        borderRadius: 14,
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
    },
    backText: { color: "#fff", fontWeight: "800" },
});
