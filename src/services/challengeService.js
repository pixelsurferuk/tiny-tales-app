// src/services/challengeService.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API } from "./ai";

const CHALLENGE_FREE_DAYS = 4;

// ─── Keys ─────────────────────────────────────────────────────────────────────

function getTodayKey(petId) {
    return `tiny_tales_challenge_today_${petId}`;
}

function getStreakKey(petId) {
    return `tiny_tales_challenge_streak_${petId}`;
}

function getBadgesKey(petId) {
    return `tiny_tales_challenge_badges_${petId}`;
}

// ─── Badge tier ───────────────────────────────────────────────────────────────

export function getBadgeTier(count) {
    if (count >= 35) return { label: "Diamond", emoji: "💎", color: "#a8d8ea" };
    if (count >= 28) return { label: "Platinum", emoji: "⚡", color: "#e5e4e2" };
    if (count >= 21) return { label: "Gold",     emoji: "🥇", color: "#FFD700" };
    if (count >= 14) return { label: "Silver",   emoji: "🥈", color: "#C0C0C0" };
    if (count >= 7)  return { label: "Bronze",   emoji: "🥉", color: "#CD7F32" };
    return null;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function todayLocal() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// Keep todayUTC as an alias so existing call sites still work
export const todayUTC = todayLocal;

export function daysBetween(dateA, dateB) {
    const a = new Date(dateA);
    const b = new Date(dateB);
    return Math.round(Math.abs((b - a) / (1000 * 60 * 60 * 24)));
}

// ─── Trial — global local cache ───────────────────────────────────────────────
// challenge_trial_started_at lives in device_usage on the server.
// We cache it in a single global key (not per-pet) so clearing a pet's
// challenge data never loses the trial start date.

const GLOBAL_TRIAL_STARTED_KEY = "tiny_tales_challenge_trial_started_at";

export async function getGlobalTrialStartedAt() {
    try {
        return await AsyncStorage.getItem(GLOBAL_TRIAL_STARTED_KEY);
    } catch {
        return null;
    }
}

export async function saveGlobalTrialStartedAt(date) {
    if (date) await AsyncStorage.setItem(GLOBAL_TRIAL_STARTED_KEY, date);
}

export function getGlobalDaysLeft(serverStartDate) {
    if (!serverStartDate) return CHALLENGE_FREE_DAYS;
    try {
        const daysSinceFirst = daysBetween(serverStartDate, todayUTC());
        return Math.max(0, CHALLENGE_FREE_DAYS - daysSinceFirst);
    } catch {
        return CHALLENGE_FREE_DAYS;
    }
}

// ─── Local streak + badges ────────────────────────────────────────────────────

export async function getLocalStreak(petId) {
    try {
        const raw = await AsyncStorage.getItem(getStreakKey(petId));
        return raw ? JSON.parse(raw) : { count: 0, lastCompletedDate: null, startDate: null };
    } catch {
        return { count: 0, lastCompletedDate: null, startDate: null };
    }
}

export async function getLocalBadges(petId) {
    try {
        const raw = await AsyncStorage.getItem(getBadgesKey(petId));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export async function saveLocalStreak(petId, streak) {
    await AsyncStorage.setItem(getStreakKey(petId), JSON.stringify(streak));
}

export async function saveLocalBadges(petId, badges) {
    await AsyncStorage.setItem(getBadgesKey(petId), JSON.stringify(badges));
}

export async function clearLocalChallengeData(petId) {
    await Promise.all([
        AsyncStorage.removeItem(getStreakKey(petId)),
        AsyncStorage.removeItem(getBadgesKey(petId)),
        AsyncStorage.removeItem(getTodayKey(petId)),
    ]);
}

export async function getTodayChallenge(petId) {
    try {
        const raw = await AsyncStorage.getItem(getTodayKey(petId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed.date !== todayUTC()) return null; // stale
        return parsed;
    } catch {
        return null;
    }
}

export async function saveTodayChallenge(petId, challenge) {
    await AsyncStorage.setItem(getTodayKey(petId), JSON.stringify({
        ...challenge,
        date: todayUTC(),
    }));
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchTodayChallenge(identityId, petId, petType, ageRange) {
    const res = await fetch(`${API}/challenge/today`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityId, petId, petType, ageRange, localDate: todayLocal() }),
    });
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) throw new Error("Server error");
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Failed");
    return json; // includes trialStartedAt from server
}

export async function completeChallenge(identityId, petId, challengeId, petSummary) {
    const res = await fetch(`${API}/challenge/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityId, petId, challengeId, pet: petSummary, localDate: todayLocal() }),
    });
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) throw new Error("Server error");
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Failed");
    return json;
}