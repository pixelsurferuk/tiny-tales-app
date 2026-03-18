// app/profiles/edit.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TextInput,
    Image,
    Alert,
    ScrollView,
    ActivityIndicator,
    Modal,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";

import Screen from "../../src/components/ui/Screen";
import TTButton from "../../src/components/ui/TTButton";
import { useTTTheme } from "../../src/theme";
import { useGlobalStyles } from "../../src/theme/globalStyles";
import { makeImageDataUrlFree } from "../../src/services/imageDataUrl";
import { classifyPetTypeFromServer } from "../../src/services/ai";
import { getPets, upsertPet } from "../../src/services/pets";
import { hexToRgba } from "../../src/utils/color";
import { VIBES, PET_TYPES } from "../../src/config";

function normalizePetType(label) {
    const l = String(label || "").trim().toLowerCase();
    return PET_TYPES.includes(l) ? l : "unknown";
}

function titleCase(s) {
    const t = String(s || "");
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// ✅ Helper: only return updatedAt when we actually have a meaningful value
function computeUpdatedAt(nextType, prevUpdatedAt) {
    const n = normalizePetType(nextType);
    if (n === "unknown") return prevUpdatedAt ?? null; // don't "freshen" unknown
    return Date.now();
}

export default function EditPetScreen() {
    const params = useLocalSearchParams();

    const t = useTTTheme();
    const gs = useGlobalStyles(t);
    const styles = useMemo(() => makeStyles(t), [t]);
    const id = params?.id ? String(params.id) : null;
    const prefillAvatarUri = params?.avatarUri ? String(params.avatarUri) : null;

    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [vibe, setVibe] = useState("Default Mode");
    const [avatarUri, setAvatarUri] = useState(null);

    // Personality dropdown modal
    const [vibeModalOpen, setVibeModalOpen] = useState(false);

    // Pet type
    const [petType, setPetType] = useState("unknown");
    const [petTypeSource, setPetTypeSource] = useState("classify"); // "classify" | "manual"
    const [petTypeLoading, setPetTypeLoading] = useState(false);

    const isEdit = !!id;
    const title = useMemo(() => (isEdit ? "Edit Pet" : "New Pet"), [isEdit]);

    // Tracks the avatar that was originally loaded (so we can detect user-changes)
    const initialAvatarRef = useRef(null);

    // Tracks the last avatar we successfully classified
    const lastClassifiedAvatarRef = useRef(null);

    // Tracks stored petTypeUpdatedAt (so we don't overwrite it with "unknown" saves)
    const storedUpdatedAtRef = useRef(null);

    // Prevent auto-classify during initial load
    const didHydrateRef = useRef(false);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                if (__DEV__) console.log("[profiles/edit]", "mount", { id, isEdit, prefillAvatarUri });

                if (isEdit) {
                    const pets = await getPets();
                    const pet = pets.find((p) => p?.id === id);
                    if (cancelled) return;

                    if (pet) {
                        const hydratedType = normalizePetType(pet?.petType);
                        const hydratedSource = pet?.petTypeSource === "manual" ? "manual" : "classify";

                        setName(pet?.name || "");
                        setVibe(pet?.vibe || "Default Mode");
                        setAvatarUri(pet?.avatarUri || null);

                        initialAvatarRef.current = pet?.avatarUri || null;

                        setPetType(hydratedType);
                        setPetTypeSource(hydratedSource);

                        storedUpdatedAtRef.current = pet?.petTypeUpdatedAt ?? null;

                        lastClassifiedAvatarRef.current = pet?.petTypeUpdatedAt ? (pet?.avatarUri || null) : null;
                        if (__DEV__) {
                            console.log("[profiles/edit]", "hydrated(edit)", {
                                petId: pet?.id,
                                avatarUri: pet?.avatarUri,
                                initialAvatar: initialAvatarRef.current,
                                petTypeRaw: pet?.petType,
                                petType: hydratedType,
                                petTypeSource: hydratedSource,
                                petTypeUpdatedAt: pet?.petTypeUpdatedAt,
                                lastClassifiedAvatar: lastClassifiedAvatarRef.current,
                            });
                        }
                    } else {
                        if (__DEV__) console.log("[profiles/edit]", "hydrated(edit) no pet found", { id, count: pets?.length });
                    }
                } else if (prefillAvatarUri) {
                    setAvatarUri(prefillAvatarUri);
                    initialAvatarRef.current = prefillAvatarUri;
                    if (__DEV__) console.log("[profiles/edit]", "hydrated(new) prefill", { prefillAvatarUri });
                } else {
                    initialAvatarRef.current = null;
                    if (__DEV__) console.log("[profiles/edit]", "hydrated(new) empty baseline");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    didHydrateRef.current = true;
                    if (__DEV__) console.log("[profiles/edit]", "hydrate complete");
                }
            }
        })();

        return () => {
            cancelled = true;
            if (__DEV__) console.log("[profiles/edit]", "unmount");
        };
    }, [id, isEdit, prefillAvatarUri]);

    // --- Image picking helpers (camera + library) ---
    const ensurePicker = useCallback(async () => {
        try {
            const ImagePicker = await import("expo-image-picker");
            return ImagePicker;
        } catch (e) {
            console.warn("expo-image-picker not available:", e?.message || e);
            return null;
        }
    }, []);

    const choosePhoto = useCallback(async () => {
        const mod = await ensurePicker();
        if (!mod || typeof mod.requestMediaLibraryPermissionsAsync !== "function") {
            Alert.alert("Not available", "Photo picking isn’t available in this build.");
            return;
        }

        const perm = await mod.requestMediaLibraryPermissionsAsync();
        if (!perm?.granted) {
            Alert.alert("Permission needed", "Please allow photo library access to choose a pet photo.");
            return;
        }

        const result = await mod.launchImageLibraryAsync({
            mediaTypes: mod.MediaTypeOptions.Images,
            quality: 0.9,
            allowsEditing: true,
            aspect: [4, 5],
        });

        if (result?.canceled) return;

        const uri = result?.assets?.[0]?.uri;
        if (uri) {
            if (__DEV__) console.log("[profiles/edit]", "choosePhoto setAvatarUri", { uri });
            setAvatarUri(uri);
        }
    }, [ensurePicker]);

    const takePhoto = useCallback(async () => {
        const mod = await ensurePicker();
        if (!mod) {
            Alert.alert("Not available", "Camera capture isn’t available in this build.");
            return;
        }

        const perm = await mod.requestCameraPermissionsAsync();
        if (!perm?.granted) {
            Alert.alert("Permission needed", "Please allow camera access to take a pet photo.");
            return;
        }

        const result = await mod.launchCameraAsync({
            mediaTypes: mod.MediaTypeOptions.Images,
            quality: 0.9,
            allowsEditing: true,
            aspect: [4, 5],
        });

        if (result?.canceled) return;

        const uri = result?.assets?.[0]?.uri;
        if (uri) {
            if (__DEV__) console.log("[profiles/edit]", "takePhoto setAvatarUri", { uri });
            setAvatarUri(uri);
        }
    }, [ensurePicker]);

    const runClassify = useCallback(
        async (opts = { force: false, reason: "unknown" }) => {
            if (!avatarUri) {
                if (__DEV__) console.log("[profiles/edit]", "runClassify skip (no avatar)", { reason: opts?.reason });
                return;
            }

            if (!opts.force && lastClassifiedAvatarRef.current === avatarUri) {
                if (__DEV__) {
                    console.log("[profiles/edit]", "runClassify skip (already classified uri)", {
                        reason: opts?.reason,
                        avatarUri,
                        lastClassifiedAvatar: lastClassifiedAvatarRef.current,
                    });
                }
                return;
            }

            setPetTypeLoading(true);

            try {
                const dataUrl = await makeImageDataUrlFree(avatarUri);

                const out = await classifyPetTypeFromServer(dataUrl).catch((err) => {
                    if (__DEV__) console.log("[profiles/edit]", "runClassify server error", { reason: opts?.reason, err: String(err?.message || err) });
                    return null;
                });

                if (__DEV__) console.log("[profiles/edit]", "runClassify server out", { reason: opts?.reason, out });

                const rawLabel = out?.label;

                if (!rawLabel) {
                    if (__DEV__) console.log("[profiles/edit]", "runClassify no label -> keep existing", { reason: opts?.reason, petType });
                    return;
                }

                const detected = normalizePetType(rawLabel);

                if (detected === "unknown" && petType !== "unknown") {
                    if (__DEV__) console.log("[profiles/edit]", "runClassify detected unknown -> keep existing", { reason: opts?.reason, rawLabel, petType });
                    return;
                }

                setPetType(detected);
                setPetTypeSource("classify");

                lastClassifiedAvatarRef.current = avatarUri;

                if (detected !== "unknown") storedUpdatedAtRef.current = Date.now();
            } catch (e) {
                if (__DEV__) console.warn("[profiles/edit] classify failed", e?.message || e);
                if (__DEV__) console.log("[profiles/edit]", "runClassify exception", { reason: opts?.reason, err: String(e?.message || e) });
            } finally {
                setPetTypeLoading(false);
                if (__DEV__) console.log("[profiles/edit]", "runClassify end", { reason: opts?.reason });
            }
        },
        [avatarUri, petType, petTypeSource]
    );

    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!avatarUri) return;
            if (!didHydrateRef.current) return;

            const isHydration = avatarUri === initialAvatarRef.current;

            if (isHydration) return;
            if (petTypeSource === "manual") return;

            if (!cancelled) await runClassify({ force: false, reason: "avatarChanged" });
        })();

        return () => {
            cancelled = true;
        };
    }, [avatarUri, petTypeSource, runClassify]);

    const canSave = useMemo(() => {
        return String(name || "").trim().length > 0 && !!avatarUri;
    }, [name, avatarUri]);

    const onSave = useCallback(async () => {
        const trimmed = String(name || "").trim();

        if (!avatarUri) {
            Alert.alert("Pet photo required", "Add a photo so we can properly identify the tiny suspect.");
            return;
        }

        if (!trimmed) {
            Alert.alert("Name required", "Give your pet a name. Even if it’s ‘Sir Barks-a-lot’.");
            return;
        }

        const normalized = normalizePetType(petType);
        const nextUpdatedAt = computeUpdatedAt(normalized, storedUpdatedAtRef.current);

        const pet = await upsertPet({
            id: id || undefined,
            name: trimmed,
            vibe: vibe === "Default Mode" ? null : vibe,
            avatarUri,

            petType: normalized,
            petTypeSource,
            petTypeUpdatedAt: nextUpdatedAt,
        });

        storedUpdatedAtRef.current = nextUpdatedAt;

        router.back();
        return pet;
    }, [name, vibe, avatarUri, id, petType, petTypeSource]);

    if (loading) {
        return (
            <Screen style={styles.safe} edges={["top", "bottom"]}>
                <View style={styles.center}>
                    <Text style={styles.loading}>Loading…</Text>
                </View>
            </Screen>
        );
    }

    return (
        <Screen style={styles.safe} edges={["top", "bottom"]}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>Back</Text>
                </Pressable>
                <Text style={styles.title}>{title}</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Name *</Text>
                <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Name"
                    placeholderTextColor={hexToRgba(t.colors.text, 0.3)}
                    style={styles.input}
                    autoCapitalize="words"
                    returnKeyType="done"
                />

                <View style={styles.avatarRow}>
                    <View style={[styles.avatarPreview, !avatarUri && styles.avatarPreviewMissing]}>
                        {avatarUri ? (
                            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                        ) : (
                            <View style={styles.avatarEmpty}></View>
                        )}

                        <View style={{ flex: 1 }}>
                            <Text style={styles.avatarTitle}>Profile picture</Text>
                            <Text style={styles.avatarSub}>For identification and future collab</Text>
                        </View>
                    </View>

                    <View style={styles.avatarBtns}>
                        <Pressable onPress={takePhoto} style={styles.smallBtn}>
                            <Text style={styles.smallBtnText}>Take Photo</Text>
                        </Pressable>
                        <Pressable onPress={choosePhoto} style={[styles.smallBtn, styles.smallBtnSecondary]}>
                            <Text style={[styles.smallBtnText, styles.smallBtnSecondaryText]}>Choose Photo</Text>
                        </Pressable>
                    </View>
                </View>

                <Text style={styles.label}>Personality *</Text>

                <Pressable onPress={() => setVibeModalOpen(true)} style={styles.dropdown} hitSlop={10}>
                    <Text style={styles.dropdownText}>{vibe || "Default Mode"}</Text>
                    <Text style={styles.dropdownChevron}>▾</Text>
                </Pressable>

                <View style={styles.typeRow}>
                    <Text style={styles.typeLabel}>Detected type</Text>
                    <View style={styles.typeRight}>
                        {petTypeLoading ? (
                            <View style={styles.typePill}>
                                <ActivityIndicator style={{ marginRight: 8 }} />
                                <Text style={styles.typePillText}>Detecting…</Text>
                            </View>
                        ) : (
                            <View style={styles.typePill}>
                                <Text style={styles.typePillText}>
                                    {titleCase(petType)} {petTypeSource === "manual" ? "(manual)" : ""}
                                </Text>
                            </View>
                        )}

                        <Pressable
                            onPress={async () => {
                                if (__DEV__) console.log("[profiles/edit]", "redetect pressed");
                                setPetTypeSource("classify");
                                await runClassify({ force: true, reason: "redetect" });
                            }}
                            style={[styles.typeBtn, styles.detectBtn]}
                            hitSlop={10}
                            disabled={!avatarUri || petTypeLoading}
                        >
                            <Text style={styles.detectBtnText}>Redetect</Text>
                        </Pressable>
                    </View>
                </View>

                <TTButton
                    variant="success"
                    title={isEdit ? "Save Changes" : "Create Profile"}
                    onPress={onSave}
                    disabled={!canSave}
                    style={styles.primaryBtn}
                />
            </ScrollView>

            {/* ✅ Personality modal dropdown */}
            <Modal
                visible={vibeModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setVibeModalOpen(false)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setVibeModalOpen(false)}>
                    <Pressable style={styles.modalCard} onPress={() => {}}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Choose personality</Text>
                            <Pressable onPress={() => setVibeModalOpen(false)} hitSlop={10}>
                                <Text style={styles.modalClose}>Close</Text>
                            </Pressable>
                        </View>

                        <ScrollView style={styles.modalList} contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
                            {VIBES.map((v) => {
                                const selected = v === (vibe || "Default Mode");
                                return (
                                    <Pressable
                                        key={v}
                                        onPress={() => {
                                            setVibe(v);
                                            setVibeModalOpen(false);
                                        }}
                                        style={[styles.modalRow, selected && styles.modalRowSelected]}
                                    >
                                        <Text style={[styles.modalRowText, selected && styles.modalRowTextSelected]}>
                                            {v}
                                        </Text>
                                        {selected ? <Text style={styles.modalCheck}>✓</Text> : null}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
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
        backBtn: { paddingVertical: 10, paddingHorizontal: 10 },
        backBtnText: { color: t.colors.text, fontWeight: "600" },
        title: { fontSize: 18, fontWeight: "600", color: t.colors.text },

        content: { paddingHorizontal: 20, paddingVertical: 5 },
        label: { marginTop: 14, marginBottom: 8, fontWeight: "600", color: t.colors.text },

        avatarRow: { marginTop: 14, gap: 10 },

        avatarPreview: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 12,
            borderRadius: 12,
            backgroundColor: "rgba(255,255,255,0.03)",
        },
        avatarPreviewMissing: {
            borderWidth: 1,
            borderColor: t.colors.danger,
            borderStyle: "dashed",
            backgroundColor: hexToRgba(t.colors.danger, 0.06),
        },

        avatarImg: { width: 78, height: 98, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.03)" },
        avatarEmpty: {
            width: 78,
            height: 98,
            borderRadius: 12,
            backgroundColor: "rgba(255,255,255,0.03)",
            alignItems: "center",
            justifyContent: "center",
        },

        avatarTitle: { fontWeight: "600", color: t.colors.text },
        avatarSub: { marginTop: 2, color: t.colors.textMuted, fontSize: 13 },

        avatarBtns: { flexDirection: "row", gap: 10 },
        smallBtn: {
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: t.colors.primary,
            alignItems: "center",
        },
        smallBtnSecondary: {
            backgroundColor: t.colors.secondary
        },
        smallBtnText: { color: t.colors.textOverPrimary, fontWeight: "600" },
        smallBtnSecondaryText: { color: t.colors.textOverSecondary },

        // ✅ Dropdown styles
        dropdown: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: "rgba(255,255,255,0.03)",
        },
        dropdownText: {
            color: t.colors.text,
            fontSize: 16,
            fontWeight: "600",
            flex: 1,
        },
        dropdownChevron: {
            color: t.colors.textMuted,
            fontSize: 18,
            fontWeight: "600",
            marginLeft: 10,
        },
        dropdownHint: {
            marginTop: 6,
            color: t.colors.textMuted,
            fontSize: 12,
        },

        typeRow: {
            marginTop: 20,
            paddingHorizontal: 2,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        typeLabel: { fontWeight: "600", color: t.colors.textMuted },
        typeRight: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
        typePill: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 7,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: t.colors.border,
            maxWidth: 200,
        },
        typePillText: { fontWeight: "600", color: t.colors.textMuted },
        typeBtn: {
            paddingVertical: 7,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: "rgba(255,124,64,0.12)",
        },

        detectBtn: {
            backgroundColor: t.colors.danger,
        },
        detectBtnText: { color: t.colors.textOverDanger, fontWeight: "600" },

        input: {
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: "rgba(255,255,255,0.03)",
            fontSize: 16,
            color: t.colors.text,
        },

        primaryBtn: { marginTop: 18 },

        center: { flex: 1, alignItems: "center", justifyContent: "center" },
        loading: { fontWeight: "600", color: "rgba(0,0,0,0.7)" },

        // ✅ Modal dropdown styles
        modalBackdrop: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            padding: 18,
            justifyContent: "center",
        },
        modalCard: {
            borderRadius: 16,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.bg,
            overflow: "hidden",
            maxHeight: "80%",
        },
        modalHeader: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: t.colors.border,
        },
        modalTitle: {
            fontWeight: "700",
            color: t.colors.text,
            fontSize: 16,
        },
        modalClose: {
            fontWeight: "700",
            color: t.colors.textMuted,
        },
        modalList: {
            paddingHorizontal: 8,
            paddingVertical: 8,
            flexGrow: 1,
        },
        modalRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderRadius: 12,
        },
        modalRowSelected: {
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: t.colors.border,
        },
        modalRowText: {
            color: t.colors.text,
            fontWeight: "600",
        },
        modalRowTextSelected: {
            color: t.colors.text,
        },
        modalCheck: {
            color: t.colors.textMuted,
            fontWeight: "800",
        },
    });
