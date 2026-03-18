import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as Application from "expo-application";
import { Platform } from "react-native";

const KEY = "tiny_tales_guest_id";

// Only override if explicitly set via env var — never use __DEV__ as it applies
// to ALL Expo Go users, not just the developer
const DEV_GUEST_ID_OVERRIDE = process.env.EXPO_PUBLIC_TEST_GUEST_ID || null;

async function getHardwareId() {
    if (Platform.OS === "android") {
        const id = Application.androidId;
        if (id) return `guest_${id}`;
    }

    if (Platform.OS === "ios") {
        const id = await Application.getIosIdForVendorAsync();
        if (id) return `guest_${id}`;
    }

    // Fallback for web / simulator
    const random = await Crypto.getRandomBytesAsync(16);
    const hex = [...random].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `guest_${hex}`;
}

export async function getStableGuestId() {
    // 1. Already stored — return immediately
    if (DEV_GUEST_ID_OVERRIDE) return DEV_GUEST_ID_OVERRIDE;
    const stored = await SecureStore.getItemAsync(KEY);
    if (stored) return stored;

    // 2. Migrate from old AsyncStorage-only installs
    const legacy = await AsyncStorage.getItem(KEY);
    if (legacy) {
        await SecureStore.setItemAsync(KEY, legacy);
        return legacy;
    }

    // 3. Derive from hardware ID so reinstalls don't get a new identity
    const id = await getHardwareId();
    await SecureStore.setItemAsync(KEY, id);
    await AsyncStorage.setItem(KEY, id);
    return id;
}