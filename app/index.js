import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { getPets } from "../src/services/pets";
import Screen from "../src/components/ui/Screen";
import TTButton from "../src/components/ui/TTButton";
import { useTTTheme, useGlobalStyles, makeHomeStyles } from "../src/theme/globalStyles";
import AuthCreditsBar from "../src/components/auth/AuthCreditsBar";
import { setAndroidNavBarStyle } from "../src/utils/navBar";
import { useEntitlements } from "../src/state/entitlements";
import ChallengeClubCard from "../src/components/ui/ChallengeClubCard";
import LoginGateButton from "../src/components/auth/LoginGateButton";
import {useAuth} from "../src/state/auth";

export default function HomeScreen() {
    const t = useTTTheme();
    const g = useGlobalStyles(t);
    const styles = useMemo(() => makeHomeStyles(t), [t]);
    const [petCount, setPetCount] = useState(0);
    const { refreshAll } = useEntitlements();
    const { isLoggedIn } = useAuth();

    const refreshPets = useCallback(async () => {
        try {
            const list = await getPets();
            setPetCount(Array.isArray(list) ? list.length : 0);
        } catch {
            setPetCount(0);
        }
    }, []);

    useEffect(() => {
        setAndroidNavBarStyle(t.isDark ? "light" : "dark");
        refreshPets();
    }, [refreshPets, t.isDark]);

    useFocusEffect(useCallback(() => {
        refreshPets();
        refreshAll({ reason: "home_focus", retries: 1, delayMs: 300 });
    }, [refreshPets, refreshAll]));

    return (
        <>
            <StatusBar style={t.isDark ? "light" : "dark"} />

            <Screen edges={["top", "bottom"]}>

                <AuthCreditsBar compact homePage />

                <ScrollView>

                    <View style={[styles.container, {paddingHorizontal:15, paddingBottom: 15, paddingTop: 45}]}>

                    <View style={[styles.card, styles.heroCard]}>
                        <View style={styles.badge}>
                            <Text style={[g.text, styles.badgeText]}>Smart Tails</Text>
                        </View>
                        <View>
                            <Text style={g.title}>Your pet's world, in their own words.</Text>
                            <Text style={g.text}>
                                Uncover your pet’s secret thoughts, chat with their personality, build a deeper bond through challenges or explore training tips and brain-boosting games for happier, smarter pets.      </Text>
                        </View>
                        {/*<TTButton title="Get A Quick Pet Thought" onPress={() => router.push("/camera")} />*/}
                        {!isLoggedIn && (
                            <LoginGateButton
                                title="Sign in"
                                variant="success"
                                gateTitle="Sign in to Tiny Tales"
                                gateSubtitle="Keep your credits and pets saved across devices."
                                onSuccess={() => refreshAll({ reason: "index_login" })}
                            />
                        )}
                    </View>

                    <ChallengeClubCard petCount={petCount} />

                    <View style={styles.card}>
                        <View style={styles.buttons}>
                            <View>
                                <Text style={g.title}>Pet Profiles</Text>
                            </View>
                            <View style={styles.featureRow}>
                                {/*<FeaturePill icon="heart-outline" label="Profiles" onPress={() => router.push("/profiles")} />*/}
                                <FeaturePill icon="chatbubbles-outline" label="Chat to pets" onPress={() => router.push("/profiles")} />
                                <FeaturePill icon="camera-outline" label="Get pet Thoughts" onPress={() => router.push("/profiles")} />
                                <FeaturePill icon="ribbon-outline" label="Training Tips" onPress={() => router.push("/profiles")} />
                                <FeaturePill icon="bulb-outline" label="Brain Games" onPress={() => router.push("/profiles")} />
                                {/*<FeaturePill icon="star-outline" label="Owner Rating" onPress={() => router.push("/profiles")} />*/}
                            </View>
                            <TTButton
                                title={petCount > 0 ? "See Your Pet Profiles" : "Set Up A Pet Profile"}
                                variant="secondary"
                                onPress={() => router.push(petCount > 0 ? "/profiles" : "/profiles/edit")}
                            />
                        </View>
                    </View>

                    <AuthCreditsBar />
                    </View>

                </ScrollView>

            </Screen>
        </>
    );
}

function FeaturePill({ icon, label, onPress }) {
    const t = useTTTheme();
    const g = useGlobalStyles(t);
    const styles = useMemo(() => makeHomeStyles(t), [t]);
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.featurePill, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        >
            <Ionicons name={icon} size={15} color={t.colors.primary} />
            <Text style={[g.text, styles.featurePillText]}>{label}</Text>
        </Pressable>
    );
}