// src/hooks/useSync.js
import { useEffect, useCallback, useRef } from "react";
import { AppState } from "react-native";
import { pushSync, pullSync } from "../services/syncService";

const PULL_ON_FOREGROUND_INTERVAL_MS = 15 * 60 * 1000; // 15 mins between foreground pulls
const PUSH_AFTER_PULL_DELAY_MS = 30 * 1000; // wait 30s after pull before allowing push

let hasPulledOnLaunch = false; // module-level — only pull once per app session on launch

export function useSync(identityId) {
    const lastPullRef = useRef(0);
    const appStateRef = useRef(AppState.currentState);

    const pull = useCallback(async (force = false) => {
        if (!identityId) return;
        const now = Date.now();
        if (!force && now - lastPullRef.current < PULL_ON_FOREGROUND_INTERVAL_MS) return;
        lastPullRef.current = now;
        await pullSync(identityId);
    }, [identityId]);

    const push = useCallback(async () => {
        if (!identityId) return;
        // Don't push too soon after a pull — local state may still be settling
        if (Date.now() - lastPullRef.current < PUSH_AFTER_PULL_DELAY_MS) return;
        await pushSync(identityId);
    }, [identityId]);

    // Pull once on first mount only (app launch)
    useEffect(() => {
        if (!identityId) return;
        if (hasPulledOnLaunch) return;
        hasPulledOnLaunch = true;
        pull(true);
    }, [identityId, pull]);

    // Pull when app comes back to foreground — but only after 15 mins
    useEffect(() => {
        const sub = AppState.addEventListener("change", (nextState) => {
            const prev = appStateRef.current;
            appStateRef.current = nextState;
            if (prev.match(/inactive|background/) && nextState === "active") {
                pull(); // respects interval — won't pull if done recently
            }
        });
        return () => sub.remove();
    }, [pull]);

    return { push, pull };
}