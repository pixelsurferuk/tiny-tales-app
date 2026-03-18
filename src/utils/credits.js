/* Normalizes credit fields from API responses into a consistent shape. */
export function parseCreditsFromResponse(r) {
    return {
        creditsRemaining: pickNumber(r?.creditsRemaining,r?.remainingPro),
        creditsTotal: pickNumber(r?.creditsTotal,r?.proTokens),
        creditsUsed: pickNumber(r?.creditsUsed,r?.proUsed),
    };
}

function pickNumber(...values) {
    for (const v of values) {
        if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return null;
}