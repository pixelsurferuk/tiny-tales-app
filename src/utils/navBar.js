import { Platform } from "react-native";

/**
 * Sets the Android navigation bar button style.
 * style: "light" (white buttons) | "dark" (black buttons)
 */
export async function setAndroidNavBarStyle(style = "light") {
    if (Platform.OS !== "android") return;
    try {
        const mod = await import("expo-navigation-bar");
        const Nav = mod?.default ?? mod;
        if (Nav?.setButtonStyleAsync) await Nav.setButtonStyleAsync(style);
    } catch (e) {
        console.warn("NavigationBar not available:", e?.message || e);
    }
}
