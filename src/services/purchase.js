// src/services/purchase.js
// ✅ Safe placeholder (works in Expo Go + dev builds).
// Real in-app purchases will be wired later using react-native-iap + server receipt validation.

import { addCreditsForPurchase } from "./credits";

export const PRODUCTS = ["smart_20", "smart_75", "smart_200"];

const PRODUCT_CREDITS = {
    smart_20: 20,
    smart_75: 75,
    smart_200: 200,
};

function formatTitle(id) {
    // Just to make your UI nicer while you're mocking
    if (id === "smart_20") return "20 Smart Thoughts";
    if (id === "smart_75") return "75 Smart Thoughts";
    if (id === "smart_200") return "200 Smart Thoughts";
    return id;
}

function formatDescription(id) {
    return "Dev mode: simulates purchase and grants credits via your server.";
}

function formatPrice(id) {
    // Optional placeholders for UI, replace later with real store prices
    if (id === "smart_20") return "£0.99";
    if (id === "smart_75") return "£2.99";
    if (id === "smart_200") return "£5.99";
    return "";
}

/**
 * Returns product list for UI.
 * In real store mode this will come from Apple/Google product metadata.
 */
export async function initStore() {
    return PRODUCTS.map((id) => ({
        productId: id,
        title: formatTitle(id),
        description: formatDescription(id),
        price: formatPrice(id),
        mode: "dev",
    }));
}

/**
 * Simulated purchase: calls your server to grant credits.
 * Later: swap this to real IAP purchase + receipt validation.
 */
export async function buyProduct(productId, deviceId) {
    const credits = PRODUCT_CREDITS[productId] ?? 0;
    if (!credits) throw new Error(`Unknown productId: ${productId}`);
    if (!deviceId) throw new Error("Missing deviceId for credit grant");

    // Server should validate + log this (even in dev) to keep UX realistic
    const r = await addCreditsForPurchase(deviceId, credits, productId);

    return {
        ok: true,
        mode: "dev",
        productId,
        creditsGranted: credits,
        ...r,
    };
}
