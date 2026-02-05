// src/services/credits.js

const API = "http://192.168.0.150:8787";

/**
 * Grants credits after a (simulated or real) purchase.
 * Server is the source of truth.
 */
export async function addCreditsForPurchase(deviceId, amount, productId) {
    const res = await fetch(`${API}/dev/add-credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            deviceId,
            amount,     // ✅ server expects "amount"
            productId,  // optional (safe to include; server will ignore)
        }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to add credits");
    }

    return json; // { ok:true, remainingPro, proTokens, proUsed }
}
