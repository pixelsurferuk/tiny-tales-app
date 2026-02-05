// src/services/ai.js
import * as FileSystem from "expo-file-system/legacy";

const API = "http://192.168.0.150:8787";

const TIMEOUTS = {
    CLASSIFY_MS: 8000,
    FREE_THOUGHT_MS: 8000,
    PRO_THOUGHT_MS: 12000,
    STATUS_MS: 4000,
    HEALTH_MS: 1200,
};

function guessMime(uri) {
    const lower = (uri || "").toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    return "image/jpeg";
}

async function waitForFile(uri, retries = 6) {
    for (let i = 0; i < retries; i++) {
        const info = await FileSystem.getInfoAsync(uri).catch(() => null);
        if (info?.exists && (info.size ?? 0) > 0) return true;
        await new Promise((r) => setTimeout(r, 120));
    }
    return false;
}

async function toDataUrlBase64(uri) {
    const ready = await waitForFile(uri);
    if (!ready) throw new Error("Image not ready");

    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
    const mime = guessMime(uri);
    return `data:${mime};base64,${base64}`;
}

async function fetchJsonWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, { ...options, signal: controller.signal });

        const text = await res.text().catch(() => "");
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = null; }

        if (!res.ok) {
            const err = new Error(`HTTP ${res.status}`);
            err.status = res.status;
            err.body = text;
            throw err;
        }

        return json;
    } finally {
        clearTimeout(id);
    }
}

// ---------- health ----------
export async function pingServer() {
    try {
        await fetchJsonWithTimeout(`${API}/health`, { method: "GET" }, TIMEOUTS.HEALTH_MS);
        return true;
    } catch {
        return false;
    }
}

// ---------- CLASSIFY ----------
export async function classifyImage(uri) {
    const imageDataUrl = await toDataUrlBase64(uri);

    const json = await fetchJsonWithTimeout(
        `${API}/classify`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageDataUrl }),
        },
        TIMEOUTS.CLASSIFY_MS
    );

    return json; // expects {ok,label,...}
}

// ---------- FREE THOUGHT ----------
export async function getThought(label) {
    const json = await fetchJsonWithTimeout(
        `${API}/thought-free`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label }),
        },
        TIMEOUTS.FREE_THOUGHT_MS
    );

    return json;
}

// ---------- PRO THOUGHT ----------
export async function getProThought(label, uri, deviceId) {
    const imageDataUrl = await toDataUrlBase64(uri);

    const json = await fetchJsonWithTimeout(
        `${API}/thought-pro`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label, imageDataUrl, deviceId }),
        },
        TIMEOUTS.PRO_THOUGHT_MS
    );

    return json;
}

// ---------- STATUS ----------
export async function getStatus(deviceId) {
    const json = await fetchJsonWithTimeout(
        `${API}/status`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceId }),
        },
        TIMEOUTS.STATUS_MS
    );

    return json;
}
