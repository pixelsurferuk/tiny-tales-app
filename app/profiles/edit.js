// app/profiles/edit.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View, Text, Pressable, TextInput, Image, ScrollView, ActivityIndicator, Modal, Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";

import Screen from "../../src/components/ui/Screen";
import TTButton from "../../src/components/ui/TTButton";
import { useTTTheme, useGlobalStyles, makeEditStyles } from "../../src/theme/globalStyles";
import { makeImageDataUrlFree } from "../../src/services/imageDataUrl";
import { classifyPetTypeFromServer } from "../../src/services/ai";
import { getPets, upsertPet, deletePet, calculateAge } from "../../src/services/pets";
import { hexToRgba } from "../../src/utils/color";
import { VIBES, PET_TYPES } from "../../src/config";
import { useTTAlert } from "../../src/components/ui/TTAlert";
import { debouncedPushSync } from "../../src/services/syncService";
import { useEntitlements } from "../../src/state/entitlements";

function normalizePetType(label) {
    const l = String(label || "").trim().toLowerCase();
    return PET_TYPES.includes(l) ? l : "unknown";
}

function titleCase(s) {
    const t = String(s || "");
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function computeUpdatedAt(nextType, prevUpdatedAt) {
    const n = normalizePetType(nextType);
    if (n === "unknown") return prevUpdatedAt ?? null;
    return Date.now();
}

function formatDateDisplay(isoString) {
    if (!isoString) return null;
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function EditPetScreen() {
    const params = useLocalSearchParams();

    const t = useTTTheme();
    const g = useGlobalStyles(t);
    const styles = useMemo(() => makeEditStyles(t), [t]);

    const id = params?.id ? String(params.id) : null;
    const prefillAvatarUri = params?.avatarUri ? String(params.avatarUri) : null;
    const isEdit = !!id;
    const title = useMemo(() => (isEdit ? "Edit Pet" : "New Pet"), [isEdit]);

    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [vibe, setVibe] = useState("Default Mode");
    const [avatarUri, setAvatarUri] = useState(null);
    const [vibeModalOpen, setVibeModalOpen] = useState(false);
    const [petType, setPetType] = useState("unknown");
    const [petTypeSource, setPetTypeSource] = useState("classify");
    const [petTypeLoading, setPetTypeLoading] = useState(false);
    const [birthDate, setBirthDate] = useState(null); // ISO string
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tempDate, setTempDate] = useState(new Date());

    const initialAvatarRef = useRef(null);
    const lastClassifiedAvatarRef = useRef(null);
    const storedUpdatedAtRef = useRef(null);
    const didHydrateRef = useRef(false);
    const classifyAttemptedRef = useRef(false);

    const alert = useTTAlert();
    const { deviceId } = useEntitlements();

    const ageDisplay = useMemo(() => {
        if (!birthDate) return null;
        const age = calculateAge(birthDate);
        return age?.label || null;
    }, [birthDate]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
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
                        classifyAttemptedRef.current = true;
                        if (pet?.birthDate) {
                            setBirthDate(pet.birthDate);
                            setTempDate(new Date(pet.birthDate));
                        }
                    }
                } else if (prefillAvatarUri) {
                    setAvatarUri(prefillAvatarUri);
                    initialAvatarRef.current = null;
                } else {
                    initialAvatarRef.current = null;
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    didHydrateRef.current = true;
                }
            }
        })();
        return () => { cancelled = true; };
    }, [id, isEdit, prefillAvatarUri]);

    const ensurePicker = useCallback(async () => {
        try {
            return await import("expo-image-picker");
        } catch (e) {
            console.warn("expo-image-picker not available:", e?.message || e);
            return null;
        }
    }, []);

    const choosePhoto = useCallback(async () => {
        const mod = await ensurePicker();
        if (!mod || typeof mod.requestMediaLibraryPermissionsAsync !== "function") {
            alert("Not available", "Photo picking isn't available in this build.");
            return;
        }
        const perm = await mod.requestMediaLibraryPermissionsAsync();
        if (!perm?.granted) {
            alert("Permission needed", "Please allow photo library access to choose a pet photo.");
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
        if (uri) setAvatarUri(uri);
    }, [ensurePicker]);

    const takePhoto = useCallback(async () => {
        const mod = await ensurePicker();
        if (!mod) {
            alert("Not available", "Camera capture isn't available in this build.");
            return;
        }
        const perm = await mod.requestCameraPermissionsAsync();
        if (!perm?.granted) {
            alert("Permission needed", "Please allow camera access to take a pet photo.");
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
        if (uri) setAvatarUri(uri);
    }, [ensurePicker]);

    const runClassify = useCallback(
        async (opts = { force: false, reason: "unknown" }) => {
            if (!avatarUri) return;
            if (!opts.force && lastClassifiedAvatarRef.current === avatarUri) return;

            setPetTypeLoading(true);
            try {
                const dataUrl = await makeImageDataUrlFree(avatarUri);
                const out = await classifyPetTypeFromServer(dataUrl).catch((err) => {
                    if (__DEV__) console.log("[profiles/edit]", "runClassify server error", { err: String(err?.message || err) });
                    return null;
                });

                const rawLabel = out?.label;
                if (!rawLabel) return;

                const detected = normalizePetType(rawLabel);
                if (detected === "unknown" && petType !== "unknown") return;

                setPetType(detected);
                setPetTypeSource("classify");
                lastClassifiedAvatarRef.current = avatarUri;
                if (detected !== "unknown") storedUpdatedAtRef.current = Date.now();
            } catch (e) {
                if (__DEV__) console.warn("[profiles/edit] classify error", e?.message || e);
            } finally {
                classifyAttemptedRef.current = true;
                setPetTypeLoading(false);
            }
        },
        [avatarUri, petType]
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!avatarUri || !didHydrateRef.current) return;
            if (avatarUri === initialAvatarRef.current) return;
            if (petTypeSource === "manual") return;
            if (!cancelled) await runClassify({ force: false, reason: "avatarChanged" });
        })();
        return () => { cancelled = true; };
    }, [avatarUri, petTypeSource, runClassify]);

    const canSave = useMemo(() =>
            String(name || "").trim().length > 0 &&
            !!avatarUri &&
            !petTypeLoading &&
            (petType !== "unknown" || classifyAttemptedRef.current) &&
            !!birthDate
        , [name, avatarUri, petTypeLoading, petType, birthDate]);

    const onDelete = useCallback(() => {
        alert(
            "Delete profile?",
            `This removes ${name || "this pet"} from profiles.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete", style: "destructive",
                    onPress: async () => {
                        try {
                            await deletePet(id);
                            debouncedPushSync(deviceId);
                            router.replace("/profiles");
                        } catch (e) {
                            alert("Delete failed", e?.message || "Couldn't delete profile.");
                        }
                    },
                },
            ]
        );
    }, [name, id, deviceId]);

    const onSave = useCallback(async () => {
        const trimmed = String(name || "").trim();
        if (!avatarUri) {
            alert("Pet photo required", "Add a photo so we can properly identify the tiny suspect.");
            return;
        }
        if (!trimmed) {
            alert("Name required", "Give your pet a name. Even if it's 'Sir Barks-a-lot'.");
            return;
        }
        if (!birthDate) {
            alert("Date of birth required", "Add your pet's birthday so we know how old they are.");
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
            birthDate,
        });
        storedUpdatedAtRef.current = nextUpdatedAt;
        debouncedPushSync(deviceId);
        router.replace("/profiles");
        return pet;
    }, [name, vibe, avatarUri, id, petType, petTypeSource, birthDate]);

    if (loading) {
        return (
            <Screen style={[styles.safe, { backgroundColor: t.colors.cardBG }]} edges={["top", "bottom"]}>
                <View style={g.center}>
                    <Text style={styles.loading}>Loading…</Text>
                </View>
            </Screen>
        );
    }

    return (
        <Screen style={[styles.safe, { backgroundColor: t.colors.cardBG }]} edges={["top", "bottom"]}>
            <View style={g.screenHeader}>
                <Pressable onPress={() => router.back()} style={g.screenHeaderBtn}>
                    <Text style={g.screenHeaderBtnText}>Back</Text>
                </Pressable>
                <Text style={[g.screenHeaderTitle, {flexShrink: 1}]}>{title}</Text>
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
                            <View style={styles.avatarEmpty} />
                        )}
                        <View style={g.flex}>
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

                <Text style={styles.label}>Date of Birth *</Text>
                <Pressable
                    onPress={() => setShowDatePicker(true)}
                    style={[styles.input, {
                        justifyContent: "center",
                        paddingVertical: 14,
                    }]}
                >
                    <Text style={[
                        { fontSize: 15 },
                        birthDate
                            ? { color: t.colors.text }
                            : { color: hexToRgba(t.colors.text, 0.3) }
                    ]}>
                        {birthDate ? formatDateDisplay(birthDate) : "Select date of birth"}
                    </Text>
                </Pressable>
                {ageDisplay && (
                    <Text style={[styles.avatarSub, { marginTop: 8, marginBottom: -4, opacity: 0.7 }]}>
                        Age: {ageDisplay}
                    </Text>
                )}

                {/* Android — inline picker shown in modal */}
                {showDatePicker && Platform.OS === "android" && (
                    <DateTimePicker
                        value={tempDate}
                        mode="date"
                        display="default"
                        maximumDate={new Date()}
                        minimumDate={new Date(1990, 0, 1)}
                        onChange={(event, selectedDate) => {
                            setShowDatePicker(false);
                            if (event.type === "dismissed") return;
                            if (selectedDate) {
                                setTempDate(selectedDate);
                                setBirthDate(selectedDate.toISOString());
                            }
                        }}
                    />
                )}

                {/* iOS — spinner in a modal sheet */}
                {Platform.OS === "ios" && (
                    <Modal
                        visible={showDatePicker}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setShowDatePicker(false)}
                    >
                        <Pressable
                            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
                            onPress={() => setShowDatePicker(false)}
                        >
                            <Pressable style={{
                                position: "absolute",
                                bottom: 0,
                                left: 0,
                                right: 0,
                                backgroundColor: t.colors.cardBG,
                                borderTopLeftRadius: 16,
                                borderTopRightRadius: 16,
                                padding: 16,
                            }}>
                                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                                    <Pressable onPress={() => setShowDatePicker(false)}>
                                        <Text style={{ color: t.colors.text, opacity: 0.6, fontSize: 16 }}>Cancel</Text>
                                    </Pressable>
                                    <Pressable onPress={() => {
                                        setBirthDate(tempDate.toISOString());
                                        setShowDatePicker(false);
                                    }}>
                                        <Text style={{ color: t.colors.primary, fontWeight: "700", fontSize: 16 }}>Done</Text>
                                    </Pressable>
                                </View>
                                <DateTimePicker
                                    value={tempDate}
                                    mode="date"
                                    display="spinner"
                                    maximumDate={new Date()}
                                    minimumDate={new Date(1990, 0, 1)}
                                    onChange={(_, selectedDate) => {
                                        if (selectedDate) setTempDate(selectedDate);
                                    }}
                                    style={{ width: "100%" }}
                                />
                            </Pressable>
                        </Pressable>
                    </Modal>
                )}

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
                                setPetTypeSource("classify");
                                await runClassify({ force: true, reason: "redetect" });
                            }}
                            style={styles.detectBtn}
                            hitSlop={10}
                            disabled={!avatarUri || petTypeLoading}
                        >
                            <Text style={styles.detectBtnText}>Redetect</Text>
                        </Pressable>
                    </View>
                </View>

                <TTButton
                    variant="success"
                    title={
                        petTypeLoading
                            ? "Detecting pet type…"
                            : petType === "unknown" && avatarUri && !classifyAttemptedRef.current
                                ? "Detecting…"
                                : petType === "unknown" && avatarUri
                                    ? "Couldn't detect type — try Redetect"
                                    : isEdit ? "Save Changes" : "Create Profile"
                    }
                    onPress={onSave}
                    disabled={!canSave}
                    style={styles.primaryBtn}
                />
                {isEdit && (
                    <TTButton
                        variant="danger"
                        title="Delete Profile"
                        onPress={onDelete}
                        style={[styles.primaryBtn, { marginTop: 12 }]}
                    />
                )}
            </ScrollView>

            <Modal visible={vibeModalOpen} transparent animationType="fade" onRequestClose={() => setVibeModalOpen(false)}>
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
                                        onPress={() => { setVibe(v); setVibeModalOpen(false); }}
                                        style={[styles.modalRow, selected && styles.modalRowSelected]}
                                    >
                                        <Text style={[styles.modalRowText, selected && styles.modalRowText]}>
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