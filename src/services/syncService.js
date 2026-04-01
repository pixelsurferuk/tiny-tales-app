// src/services/syncService.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPets, savePets, getActivePetId, setActivePetId } from "./pets";
import { API } from "./ai";

const SYNC_KEY = "tiny_tales_last_sync";
const SYNC_DEBOUNCE_MS = 3000;

let pushTimer = null;

// ─── Chat helpers ─────────────────────────────────────────────────────────────

const CHAT_PREFIX = "tiny_tales_chat_";

async function getAllChatData() {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const chatKeys = keys.filter(k => k.startsWith(CHAT_PREFIX));
        if (!chatKeys.length) return {};
        const pairs = await AsyncStorage.multiGet(chatKeys);
        const chats = {};
        for (const [key, val] of pairs) {
            try { chats[key.replace(CHAT_PREFIX, "")] = JSON.parse(val); } catch {}
        }
        return chats;
    } catch {
        return {};
    }
}

async function restoreChatData(chats) {
    if (!chats || typeof chats !== "object") return;
    const pairs = Object.entries(chats).map(([petId, messages]) => [
        `${CHAT_PREFIX}${petId}`,
        JSON.stringify(messages),
    ]);
    if (pairs.length) await AsyncStorage.multiSet(pairs);
}

// ─── Challenge data helpers ───────────────────────────────────────────────────

const STREAK_PREFIX = "tiny_tales_challenge_streak_";
const BADGES_PREFIX = "tiny_tales_challenge_badges_";
const GLOBAL_TRIAL_KEY = "tiny_tales_challenge_trial_days";

async function getAllChallengeData() {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const streakKeys = keys.filter(k => k.startsWith(STREAK_PREFIX));
        const badgeKeys = keys.filter(k => k.startsWith(BADGES_PREFIX));
        const globalTrialRaw = await AsyncStorage.getItem(GLOBAL_TRIAL_KEY);

        const allKeys = [...streakKeys, ...badgeKeys];
        const pairs = allKeys.length ? await AsyncStorage.multiGet(allKeys) : [];

        const streaks = {};
        const badges = {};
        for (const [key, val] of pairs) {
            try {
                if (key.startsWith(STREAK_PREFIX)) {
                    streaks[key.replace(STREAK_PREFIX, "")] = JSON.parse(val);
                } else {
                    badges[key.replace(BADGES_PREFIX, "")] = JSON.parse(val);
                }
            } catch {}
        }

        return {
            streaks,
            badges,
            globalTrialDays: globalTrialRaw ? JSON.parse(globalTrialRaw) : [],
        };
    } catch {
        return { streaks: {}, badges: {}, globalTrialDays: [] };
    }
}

async function restoreChallengeData({ streaks, badges, globalTrialDays } = {}) {
    const pairs = [];
    for (const [petId, val] of Object.entries(streaks || {})) {
        pairs.push([`${STREAK_PREFIX}${petId}`, JSON.stringify(val)]);
    }
    for (const [petId, val] of Object.entries(badges || {})) {
        pairs.push([`${BADGES_PREFIX}${petId}`, JSON.stringify(val)]);
    }
    if (pairs.length) await AsyncStorage.multiSet(pairs);
    if (globalTrialDays?.length) {
        await AsyncStorage.setItem(GLOBAL_TRIAL_KEY, JSON.stringify(globalTrialDays));
    }
}

// ─── Seen tips helpers ────────────────────────────────────────────────────────

const SEEN_TIPS_PREFIX = "tiny_tales_seen_tips_";

async function getAllSeenTips() {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const seenKeys = keys.filter(k => k.startsWith(SEEN_TIPS_PREFIX));
        if (!seenKeys.length) return {};
        const pairs = await AsyncStorage.multiGet(seenKeys);
        const out = {};
        for (const [key, val] of pairs) {
            const shortKey = key.replace(SEEN_TIPS_PREFIX, "");
            try { out[shortKey] = JSON.parse(val) || []; } catch { out[shortKey] = []; }
        }
        return out;
    } catch {
        return {};
    }
}

async function restoreSeenTips(seenTips) {
    if (!seenTips || typeof seenTips !== "object") return;
    const pairs = Object.entries(seenTips).map(([key, val]) => [
        `${SEEN_TIPS_PREFIX}${key}`,
        JSON.stringify(val),
    ]);
    if (pairs.length > 0) await AsyncStorage.multiSet(pairs);
}

// ─── Pets serialisation ───────────────────────────────────────────────────────

function stripAvatarUri(pet) {
    const { avatarUri, ...rest } = pet;
    return rest;
}

function mergePets(localPets, remotePets) {
    const localMap = new Map((localPets || []).map(p => [p.id, p]));
    const remoteMap = new Map((remotePets || []).map(p => [p.id, p]));
    const merged = [];

    for (const [id, remotePet] of remoteMap) {
        const localPet = localMap.get(id);
        merged.push({
            ...remotePet,
            avatarUri: localPet?.avatarUri || null,
        });
    }

    for (const [id, localPet] of localMap) {
        if (!remoteMap.has(id)) merged.push(localPet);
    }

    return merged;
}

// ─── Push ─────────────────────────────────────────────────────────────────────

export async function pushSync(identityId) {
    if (!identityId) return;
    try {
        const [pets, seenTips, clubData, chats] = await Promise.all([
            getPets(),
            getAllSeenTips(),
            getAllChallengeData(),
            getAllChatData(),
        ]);

        const payload = {
            identityId,
            pets: pets.map(stripAvatarUri),
            seenTips,
            clubData,
            chats,
        };

        const res = await fetch(`${API}/sync/push`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) return;

        const json = await res.json();
        if (json.ok) {
            await AsyncStorage.setItem(SYNC_KEY, new Date().toISOString());
        }
    } catch (e) {
        console.warn("[sync] push failed", e?.message);
    }
}

export function debouncedPushSync(identityId) {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
        pushSync(identityId);
        pushTimer = null;
    }, SYNC_DEBOUNCE_MS);
}

// ─── Pull ─────────────────────────────────────────────────────────────────────

export async function pullSync(identityId) {
    if (!identityId) return null;
    try {
        const res = await fetch(`${API}/sync/pull`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identityId }),
        });

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) return null;

        const json = await res.json();
        if (!json.ok || !json.data) return null;

        const { pets: remotePets, seenTips, clubData, chats } = json.data;

        if (Array.isArray(remotePets) && remotePets.length > 0) {
            const localPets = await getPets();
            const merged = mergePets(localPets, remotePets);
            await savePets(merged);

            const activeId = await getActivePetId();
            if (!activeId && merged.length > 0) {
                await setActivePetId(merged[0].id);
            }
        }

        if (seenTips && typeof seenTips === "object") {
            await restoreSeenTips(seenTips);
        }

        if (clubData && typeof clubData === "object") {
            await restoreChallengeData(clubData);
        }

        if (chats && typeof chats === "object") {
            await restoreChatData(chats);
        }

        await AsyncStorage.setItem(SYNC_KEY, new Date().toISOString());
        return json.data;
    } catch (e) {
        console.warn("[sync] pull failed", e?.message);
        return null;
    }
}

// ─── Last sync time ───────────────────────────────────────────────────────────

export async function getLastSyncTime() {
    try {
        return await AsyncStorage.getItem(SYNC_KEY);
    } catch {
        return null;
    }
}