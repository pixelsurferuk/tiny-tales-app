import React, { useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { getPets } from "../src/services/pets";
import Screen from "../src/components/ui/Screen";
import TTButton from "../src/components/ui/TTButton";
import { useTTTheme } from "../src/theme";
import { useGlobalStyles } from "../src/theme/globalStyles";
import { useEntitlements } from "../src/state/entitlements";
import AuthCreditsBar from "../src/components/ui/AuthCreditsBar";
import { setAndroidNavBarStyle } from "../src/utils/navBar";

export default function HomeScreen() {
  const t = useTTTheme();
  const g = useGlobalStyles(t);
  const styles = React.useMemo(() => makeStyles(t), [t]);
  const [petCount, setPetCount] = React.useState(0);


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
      //router.push("/paywall");
  }, [refreshPets, t.isDark]);

  useFocusEffect(
      useCallback(() => {
        refreshPets();
      }, [refreshPets])
  );

  return (
      <>
        <StatusBar style={t.isDark ? "light" : "dark"} />
        <Screen>
          <View style={[g.screen, styles.container]}>
            <View style={styles.heroCard}>
              <View style={styles.badge}>
                <Ionicons name="sparkles" size={14} color={t.colors.textOverPrimary} />
                <Text style={styles.badgeText}>Tiny Tales</Text>
              </View>

              <Text style={styles.title}>What’s your pet really thinking?</Text>

              <Text style={styles.subtitle}>
                Reveal pet thoughts, chat with their personalities, and turn everyday moments into Tiny Tales.
              </Text>

              <View style={styles.featureRow}>
                <FeaturePill
                    icon="camera-outline"
                    label="Thoughts"
                    onPress={() => router.push("/camera")}
                />
                <FeaturePill
                    icon="chatbubbles-outline"
                    label="Chats"
                    onPress={() => router.push("/profiles")}
                />
                <FeaturePill
                    icon="heart-outline"
                    label="Profiles"
                    onPress={() => router.push("/profiles")}
                />
              </View>
            </View>

            <View style={styles.actionsCard}>
              <View style={styles.buttons}>
                <TTButton
                    title="Get Quick Pet Thought"
                    onPress={() => router.push("/camera")}
                />

                <TTButton
                    title={
                      petCount > 0
                          ? `Chat With Your Pet${petCount > 1 ? "s" : ""} (${petCount})`
                          : "Set Up A Pet Profile"
                    }
                    variant="secondary"
                    onPress={() => router.push("/profiles")}
                />
              </View>
            </View>

            <View style={styles.accountCard}>
              <AuthCreditsBar />
            </View>
          </View>
        </Screen>
      </>
  );
}

function FeaturePill({ icon, label, onPress }) {
  const t = useTTTheme();
  const styles = React.useMemo(() => makeStyles(t), [t]);

  return (
      <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.featurePill,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
      >
        <Ionicons name={icon} size={15} color={t.colors.primary} />
        <Text style={styles.featurePillText}>{label}</Text>
      </Pressable>
  );
}

const makeStyles = (t) =>
    StyleSheet.create({
      container: {
        flex: 1,
        justifyContent: "center",
        gap: 16,
      },

      heroCard: {
        borderRadius: 28,
        padding: 22,
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.cardBG,
        shadowColor: "#000",
        shadowOpacity: t.isDark ? 0.18 : 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        gap: 14,
      },

      badge: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: t.colors.primary,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
      },

      badgeText: {
        color: t.colors.textOverPrimary,
        fontWeight: "800",
        fontSize: 12,
        letterSpacing: 0.3,
      },

      title: {
        color: t.colors.text,
        fontSize: 32,
        lineHeight: 36,
        fontWeight: "900",
      },

      subtitle: {
        color: t.colors.text,
        opacity: 0.78,
        fontSize: 16,
        lineHeight: 24,
      },

      featureRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginTop: 2,
      },

      featurePill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.cardBG,
      },

      featurePillText: {
        color: t.colors.text,
        fontSize: 13,
        fontWeight: "700",
      },

      actionsCard: {
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.cardBG,
      },

      buttons: {
        gap: 12,
      },

      accountCard: {
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.cardBG,
      },
    });