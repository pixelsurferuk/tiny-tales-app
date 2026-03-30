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

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function todayUTC() {
    return new Date().toISOString().slice(0, 10);
}

export function daysBetween(dateA, dateB) {
    const a = new Date(dateA);
    const b = new Date(dateB);
    return Math.round(Math.abs((b - a) / (1000 * 60 * 60 * 24)));
}

// ─── Trial — purely server-side ───────────────────────────────────────────────
// challenge_trial_started_at lives in device_usage on the server.
// Transferred guest → user on sign in via transfer_guest_credits RPC.
// No local storage — always use the date returned from /challenge/today.

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
        body: JSON.stringify({ identityId, petId, petType, ageRange }),
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
        body: JSON.stringify({ identityId, petId, challengeId, pet: petSummary }),
    });
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) throw new Error("Server error");
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Failed");
    return json;
}