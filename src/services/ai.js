import { getAccessToken } from "./auth";
import { API_FALLBACK_URL, API_TIMEOUTS } from "../config";

export const API = process.env.EXPO_PUBLIC_API_URL || API_FALLBACK_URL;

const TIMEOUTS = API_TIMEOUTS;

function makeReqId() {
    return `${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

async function buildHeaders(extra = {}) {
    const token = await getAccessToken().catch(() => null);
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extra,
    };
}

async function fetchJsonWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, { ...options, signal: controller.signal });

        const text = await res.text().catch(() => "");
        let json = null;

        if (text) {
            try {
                json = JSON.parse(text);
            } catch {
                const err = new Error(`Invalid JSON from ${url}`);
                err.code = "BAD_JSON";
                err.status = res.status;
                err.body = text.slice(0, 300);
                throw err;
            }
        }

        if (!res.ok) {
            const err = new Error(`HTTP ${res.status}`);
            err.status = res.status;
            err.body = text;
            err.data = json;
            throw err;
        }

        return json;
    } catch (e) {
        if (e?.name === "AbortError") {
            const err = new Error(`Timeout after ${timeoutMs}ms: ${url}`);
            err.code = "TIMEOUT";
            throw err;
        }
        throw e;
    } finally {
        clearTimeout(id);
    }
}

export async function pingServer() {
    try {
        await fetchJsonWithTimeout(`${API}/health`, { method: "GET" }, TIMEOUTS.HEALTH_MS);
        return true;
    } catch {
        return false;
    }
}

export async function getStatus(identityId) {
    return fetchJsonWithTimeout(
        `${API}/status`,
        {
            method: "POST",
            headers: await buildHeaders(),
            body: JSON.stringify({ identityId }),
        },
        TIMEOUTS.STATUS_MS
    );
}

export async function getServerStatus(identityId) {
    return getStatus(identityId);
}

export async function getThoughtFromServer({ imageDataUrl, identityId, pet }) {
    return fetchJsonWithTimeout(
        `${API}/thought`,
        {
            method: "POST",
            headers: await buildHeaders(),
            body: JSON.stringify({
                imageDataUrl,
                identityId: identityId || null,
                pet: pet || null,
                reqId: makeReqId(),
            }),
        },
        TIMEOUTS.THOUGHT_MS
    );
}

export async function classifyPetTypeFromServer(imageDataUrl) {
    return fetchJsonWithTimeout(
        `${API}/classify`,
        {
            method: "POST",
            headers: await buildHeaders(),
            body: JSON.stringify({ imageDataUrl }),
        },
        TIMEOUTS.STATUS_MS
    );
}

export async function askPetQuestionFromServer({ imageDataUrl, question, pet, history, identityId }) {
    return fetchJsonWithTimeout(
        `${API}/ask`,
        {
            method: "POST",
            headers: await buildHeaders(),
            body: JSON.stringify({
                imageDataUrl,
                question,
                pet: pet || null,
                history: Array.isArray(history) ? history : null,
                identityId: identityId || null,
            }),
        },
        TIMEOUTS.ASK_MS
    );
}
