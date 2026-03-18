import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../src/state/auth";
import { EntitlementsProvider } from "../src/state/entitlements";
import { useServerWarmup } from "../src/hooks/useServerWarmup";

function RootLayout() {
    useServerWarmup();
    return <Stack screenOptions={{ headerShown: false }} />;
}

export default function Layout() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <EntitlementsProvider>
                    <RootLayout />
                </EntitlementsProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
}