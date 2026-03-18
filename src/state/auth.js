import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";

import { supabase } from "../services/supabase";
import { getSession, getCurrentUser, logout as authLogout } from "../services/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [ready, setReady] = useState(false);
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);

    const refresh = useCallback(async () => {
        try {
            const [nextSession, nextUser] = await Promise.all([
                getSession(),
                getCurrentUser(),
            ]);

            setSession(nextSession ?? null);
            setUser(nextUser ?? null);
            return nextSession ?? null;
        } catch (e) {
            console.warn("[auth] refresh failed", e);
            setSession(null);
            setUser(null);
            return null;
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const [initialSession, initialUser] = await Promise.all([
                    getSession(),
                    getCurrentUser(),
                ]);

                if (!mounted) return;
                setSession(initialSession ?? null);
                setUser(initialUser ?? null);
            } catch (e) {
                console.warn("[auth] initial session failed", e);
                if (mounted) {
                    setSession(null);
                    setUser(null);
                }
            } finally {
                if (mounted) setReady(true);
            }
        })();

        const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
            if (!mounted) return;

            setSession(nextSession ?? null);
            setUser(nextSession?.user ?? null);
            setReady(true);
        });

        return () => {
            mounted = false;
            sub?.subscription?.unsubscribe?.();
        };
    }, []);

    const openLogin = useCallback(() => {
        router.push("/paywall");
    }, []);

    const signOut = useCallback(async () => {
        await authLogout();
        setSession(null);
        setUser(null);
    }, []);

    const email = user?.email ?? "";
    const userId = user?.id ?? null;

    const value = useMemo(
        () => ({
            ready,
            session,
            user,
            userId,
            email,
            isLoggedIn: !!session,
            refresh,
            refreshAuth: refresh,
            logout: signOut,
            openLogin,
        }),
        [ready, session, user, userId, email, refresh, signOut, openLogin]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
    return ctx;
}