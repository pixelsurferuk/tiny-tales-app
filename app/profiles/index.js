import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Image, Alert, ScrollView } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";

import Screen from "../../src/components/ui/Screen";
import TTButton from "../../src/components/ui/TTButton";
import { useTTTheme } from "../../src/theme";
import { getPets, deletePet, setActivePetId, getActivePetId } from "../../src/services/pets";
import { AppBannerAd } from "../../src/ads/admob";
import { useEntitlements } from "../../src/state/entitlements";

function requiresPhoto(pet, action) {
    if (!pet.avatarUri) {
        Alert.alert("No photo", `This profile needs a photo first so we've got something to ${action}.`);
        return true;
    }
    return false;
}

export default function ProfilesScreen() {
    const params = useLocalSearchParams();
    const mode = params?.mode ? String(params.mode) : null;
    const isSelectMode = mode === "select";

    const [pets, setPets] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [loading, setLoading] = useState(true);

    const t = useTTTheme();
    const styles = useMemo(() => makeStyles(t), [t]);
    const { isPro } = useEntitlements();

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [list, aid] = await Promise.all([getPets(), getActivePetId()]);
            setPets(Array.isArray(list) ? list : []);
            setActiveId(aid || null);
        } catch (e) {
            console.warn("[profiles] load failed", e?.message || e);
            setPets([]);
            setActiveId(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const onPickActive = useCallback(async (petId) => {
        await setActivePetId(petId);
        setActiveId(petId);
        if (isSelectMode) router.back();
    }, [isSelectMode]);

    const onDelete = useCallback((pet) => {
        Alert.alert(
            "Delete profile?",
            `This removes ${pet?.name || "this pet"} from profiles.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deletePet(pet.id);
                            await load();
                        } catch (e) {
                            Alert.alert("Delete failed", e?.message || "Couldn't delete profile.");
                        }
                    },
                },
            ]
        );
    }, [load]);

    const onGetThought = useCallback(async (pet) => {
        if (requiresPhoto(pet, "judge")) return;
        await setActivePetId(pet.id);
        setActiveId(pet.id);
        router.push({
            pathname: "/preview",
            params: {
                uri: pet.avatarUri,
                src: "profiles",
                petId: pet.id,
                ...(pet.petType ? { hintLabel: pet.petType } : {}),
            },
        });
    }, []);

    const onChat = useCallback(async (pet) => {
        if (requiresPhoto(pet, "chat")) return;
        await setActivePetId(pet.id);
        setActiveId(pet.id);
        router.push({ pathname: "/ask", params: { uri: pet.avatarUri, src: "profiles", petId: pet.id } });
    }, []);

    const headerTitle = isSelectMode ? "Select a Pet" : "Pet Profiles";

    return (
        <Screen style={styles.safe} edges={["top", "bottom"]}>
            <AppBannerAd enabled={!isPro} refreshKey="profiles" />

            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.headerBtn}>
                    <Text style={styles.headerBtnText}>Back</Text>
                </Pressable>
                <Text style={styles.title}>{headerTitle}</Text>
                <Pressable onPress={() => router.push("/profiles/edit")} style={styles.headerBtn}>
                    <Text style={styles.headerBtnText}>Add</Text>
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <Text style={styles.loading}>Loading…</Text>
                </View>
            ) : pets.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>No profiles yet</Text>
                    <Text style={styles.emptySub}>Add a pet so their judgement stays consistent.</Text>
                    <TTButton
                        title="Create Pet Profile"
                        onPress={() => router.push("/profiles/edit")}
                        style={styles.primaryBtn}
                    />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
                    {pets.map((pet) => {
                        const selected = pet.id === activeId;
                        return (
                            <View key={pet.id} style={styles.card}>
                                <Pressable onPress={() => onPickActive(pet.id)} style={styles.row} hitSlop={10}>
                                    <View style={styles.avatarWrap}>
                                        {pet.avatarUri ? (
                                            <Image source={{ uri: pet.avatarUri }} style={styles.avatar} />
                                        ) : (
                                            <View style={[styles.avatar, styles.avatarFallback]}>
                                                <Text style={styles.avatarFallbackText}>?</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.name} numberOfLines={1}>
                                            {pet.name || "Unnamed"}
                                        </Text>
                                        <Text style={styles.sub} numberOfLines={1}>
                                            {pet.vibe || "Default voice"}
                                        </Text>
                                    </View>

                                    <View style={styles.actions}>
                                        <Pressable
                                            onPress={() => router.push({ pathname: "/profiles/edit", params: { id: pet.id } })}
                                            style={styles.actionBtn}
                                            hitSlop={10}
                                        >
                                            <Text style={styles.actionBtnText}>Edit</Text>
                                        </Pressable>

                                        <Pressable onPress={() => onDelete(pet)} style={styles.actionBtnDanger} hitSlop={10}>
                                            <Text style={styles.actionBtnDangerText}>Delete</Text>
                                        </Pressable>
                                    </View>
                                </Pressable>

                                <TTButton
                                    title={`Get ${pet.name || "Pet"}'s Quick Thought`}
                                    onPress={() => onGetThought(pet)}
                                    style={styles.actionSpacing}
                                />

                                <TTButton
                                    title={`Chat with ${pet.name || "Pet"}`}
                                    variant="secondary"
                                    onPress={() => onChat(pet)}
                                    style={styles.actionSpacing}
                                />
                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </Screen>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: t.colors.bg },

        header: {
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottomWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.cardBG,
        },
        headerBtn: { paddingVertical: 10, paddingHorizontal: 10 },
        headerBtnText: { color: t.colors.text, fontWeight: "600" },
        title: { fontSize: 18, fontWeight: "600", color: t.colors.text },

        center: { flex: 1, alignItems: "center", justifyContent: "center" },
        loading: { fontWeight: "600", color: t.colors.textMuted },

        empty: { flex: 1, padding: 20, alignItems: "center", justifyContent: "center" },
        emptyTitle: { fontSize: 18, fontWeight: "600", color: t.colors.text },
        emptySub: { marginTop: 8, marginBottom: 20, color: t.colors.textMuted, textAlign: "center" },

        list: { padding: 16, paddingBottom: 28, gap: 12 },

        card: {
            borderRadius: 18,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: "rgba(255,255,255,0.04)",
            padding: 12,
        },
        cardSelected: { borderColor: t.colors.primary, borderWidth: 2 },

        row: { flexDirection: "row", alignItems: "center", gap: 12 },

        avatarWrap: { width: 70, height: 90 },
        avatar: { width: 70, height: 90, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.06)" },
        avatarFallback: { alignItems: "center", justifyContent: "center" },
        avatarFallbackText: { fontSize: 20, fontWeight: "600", color: "rgba(0,0,0,0.35)" },

        name: { fontWeight: "600", color: t.colors.text, fontSize: 16 },
        sub: { marginTop: 2, color: t.colors.textMuted, fontWeight: "700", fontSize: 12 },

        actions: { alignItems: "flex-end", gap: 8 },
        actionBtn: {
            paddingVertical: 10,
            paddingHorizontal: 15,
            borderRadius: 10,
            backgroundColor: t.colors.success,
        },
        actionBtnText: { color: t.colors.textOverSuccess, fontWeight: "600", fontSize: 12, textAlign: "center",  width: 65 },
        actionBtnDanger: {
            paddingVertical: 10,
            paddingHorizontal: 15,
            borderRadius: 10,
            backgroundColor: t.colors.danger,
        },
        actionBtnDangerText: { color: t.colors.textOverDanger, fontWeight: "600", fontSize: 12, textAlign: "center",  width: 65  },

        actionSpacing: { marginTop: 10 },
    });