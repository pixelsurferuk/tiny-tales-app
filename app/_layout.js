import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import { Pacifico_400Regular } from "@expo-google-fonts/pacifico";
import * as SplashScreen from "expo-splash-screen";
import { TTAlertProvider } from "../src/components/ui/TTAlert";

import { AuthProvider } from "../src/state/auth";
import { EntitlementsProvider } from "../src/state/entitlements";
import { useServerWarmup } from "../src/hooks/useServerWarmup";

SplashScreen.preventAutoHideAsync();

function RootLayout() {
    useServerWarmup();
    return <Stack screenOptions={{ headerShown: false }} />;
}

export default function Layout() {
    const [fontsLoaded] = useFonts({
        Nunito_400Regular,
        Nunito_600SemiBold,
        Nunito_700Bold,
        Nunito_800ExtraBold,
        Pacifico_400Regular,
    });

    if (!fontsLoaded) return null;

    SplashScreen.hideAsync();

    return (
        <SafeAreaProvider>
            <AuthProvider>
                <EntitlementsProvider>
                    <TTAlertProvider>
                        <RootLayout />
                    </TTAlertProvider>
                </EntitlementsProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
}