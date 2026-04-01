/**
 * src/config.js
 *
 * Central settings file. All app-wide toggles, product IDs, ad unit IDs,
 * copy-editable content lists, and tuning values live here.
 */

// ─── Feature flags ────────────────────────────────────────────────────────────
export const SUBSCRIPTIONS_ENABLED = true;
export const REWARDED_ADS_ENABLED = true;

// ─── Dev / test overrides (set to true locally, never commit as true) ─────────
export const TEST_FORCE_NOT_PRO = false;
export const TEST_FORCE_ZERO_CREDITS = false;
export const SHARE_CAPTION_HEADLINE = "Check out what my pet is thinking! 😅";
export const SHARE_CAPTION_BODY = "Try Companio: Search \"Companio your pet thoughts and chat app\" on {store}.";

// ─── API ──────────────────────────────────────────────────────────────────────
export const API_FALLBACK_URL = "https://tiny-tales-oms6.onrender.com";

export const API_TIMEOUTS = {
    HEALTH_MS: 6000,
    STATUS_MS: 8000,
    THOUGHT_MS: 70000,
    ASK_MS: 70000,
};

// ─── In-app purchases ─────────────────────────────────────────────────────────
export const CREDIT_PRODUCTS = [
    { id: "10_smart_thoughts",  label: "10 Credits",  blurb: "Try chat + thoughts" },
    { id: "25_smart_thoughts",  label: "25 Credits",  blurb: "Handy top-up"        },
    { id: "50_smart_thoughts",  label: "50 Credits",  blurb: "Better value"        },
    { id: "100_smart_thoughts", label: "100 Credits", blurb: "Big pack"            },
];

export const RC_ENTITLEMENT_ID = "pro_access";

// ─── Ads ──────────────────────────────────────────────────────────────────────

/*export const BANNER_AD_UNIT_IDS = {
    ios:     "ca-app-pub-5887472906492199/5644835923",
    android: "ca-app-pub-5887472906492199/5644835923",
};

export const REWARDED_AD_UNIT_IDS = {
    ios:     "ca-app-pub-5887472906492199/8799767245",
    android: "ca-app-pub-5887472906492199/8799767245",
};*/

export const BANNER_AD_UNIT_IDS = {
    ios:     "ca-app-pub-3940256099942544/2934735716",
    android: "ca-app-pub-3940256099942544/6300978111",
};

export const REWARDED_AD_UNIT_IDS = {
    ios:     "ca-app-pub-3940256099942544/1712485313",
    android: "ca-app-pub-3940256099942544/5224354917",
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const CHAT_STORAGE_LIMIT = 50;

export const CREDIT_ERROR_CODES = new Set([
    "FREE_CHAT_LIMIT_REACHED",
    "PRO_LIMIT_REACHED",
    "NO_CREDITS",
    "CREDITS_REQUIRED",
]);

// ─── Pet profiles ─────────────────────────────────────────────────────────────

export const VIBES = [
    "Default Mode",
    "Chaos Gremlin",
    "Prince Charming",
    "Princess Energy",
    "Affectionate Shadow",
    "Judgy Bean",
    "Sweet Angel",
    "Spoiled Royalty",
    "Dramatic Icon",
    "Zen Loaf",
    "Anxious Genius",
    "Moody Monarch",
];

export const PET_TYPES = [
    "man", "woman", "dog", "cat", "horse", "bird", "rabbit", "hamster", "fish", "guinea pig",
    "turtle", "tortoise", "parrot", "ferret", "hedgehog", "chinchilla", "gecko", "snake", "lizard",
    "pig", "goat", "sheep", "cow", "chicken", "duck", "goose", "donkey", "pony", "alpaca", "llama",
    "deer", "fox", "wolf", "raccoon", "squirrel", "rat", "mouse", "gerbil", "frog", "toad",
    "axolotl", "crab", "shrimp", "goldfish", "budgie", "canary", "cockatiel", "pigeon", "swan",
    "peacock", "other", "unknown",
];
