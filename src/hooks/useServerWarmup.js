// src/hooks/useServerWarmup.js
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { pingServer } from "../services/ai";

export function useServerWarmup() {
    const appState = useRef(AppState.currentState);
    const retryTimeout = useRef(null);

    useEffect(() => {
        // Ping immediately on first mount (app launch / cold start)
        pingServer().catch(() => {});
        retryTimeout.current = setTimeout(() => {
            pingServer().catch(() => {});
        }, 2500);

        const onChange = async (nextState) => {
            const wasBackground = appState.current.match(/inactive|background/);
            const isActive = nextState === "active";

            appState.current = nextState;

            if (wasBackground && isActive) {
                // Wake server on foreground resume
                pingServer().catch(() => {});

                // Retry once after short delay for Render cold starts
                retryTimeout.current = setTimeout(() => {
                    pingServer().catch(() => {});
                }, 2500);
            }

            if (nextState !== "active" && retryTimeout.current) {
                clearTimeout(retryTimeout.current);
                retryTimeout.current = null;
            }
        };

        const sub = AppState.addEventListener("change", onChange);

        return () => {
            sub.remove();
            if (retryTimeout.current) clearTimeout(retryTimeout.current);
        };
    }, []);
}
