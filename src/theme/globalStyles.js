// src/theme/globalStyles.js
import { StyleSheet, useColorScheme } from "react-native";

/**
 * 🎯 SINGLE SOURCE OF TRUTH
 * Theme tokens · Global styles · Screen-specific styles
 */

// ─────────────────────────────────────────
// 🔧 BASE TOKENS
// ─────────────────────────────────────────

const base = {
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
    radius: { sm: 8, md: 12, lg: 16, xl: 24 },

    font: {
        xs: 12, sm: 14, md: 16, lg: 20, xl: 26, xxl: 34,
    },

    fontFamily: {
        regular: "Nunito_400Regular",
        medium: "Nunito_600SemiBold",
        bold: "Nunito_700Bold",
        heavy: "Nunito_800ExtraBold",
        logo: "Pacifico_400Regular",
        title: "Nunito_800ExtraBold",
    },

    shadow: {
        card: {
            shadowOpacity: 0.1,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 8 },
            elevation: 5,
        },
    },
};

// ─────────────────────────────────────────
// 🎨 COLOUR PALETTES
// ─────────────────────────────────────────

const palettes = {
    light: {
        mode: "light",
        colors: {
            bg: "#eeedf3",
            surface: "#FFFFFF",
            cardBG: "#FFFFFF",
            text: "#1B1F2A",
            textMuted: "rgba(27,31,42,0.7)",
            textOverPrimary: "#2d2d35",
            textOverSecondary: "#2d2d35",
            textOverSuccess: "#2d2d35",
            textOverDanger: "#2d2d35",
            border: "rgba(0,0,0,0.08)",
            primary: "#5dd5c9",
            secondary: "#9675ce",
            third: "#E8637A",
            textOverThird: "#2d2d35",
            accent: "#f8db46",
            success: "#51c17b",
            danger: "#EF4444",
            overlay: "rgba(0,0,0,0.35)",
        },
    },
    dark: {
        mode: "dark",
        colors: {
            bg: "#1e1f27",
            surface: "#2d2d35",
            cardBG: "#2d2d35",
            text: "#F5F7FF",
            textMuted: "rgba(245,247,255,0.7)",
            textOverPrimary: "#2d2d35",
            textOverSecondary: "#2d2d35",
            textOverSuccess: "#2d2d35",
            textOverDanger: "#2d2d35",
            border: "rgba(255,255,255,0.1)",
            primary: "#5dd5c9",
            secondary: "#9675ce",
            third: "#E8637A",
            textOverThird: "#2d2d35",
            accent: "#f8db46",
            success: "#51c17b",
            danger: "#EF4444",
            overlay: "rgba(0,0,0,0.35)",
        },
    },
};

// ─────────────────────────────────────────
// 🪝 THEME HOOK
// ─────────────────────────────────────────

export function useTTTheme() {
    const scheme = useColorScheme();
    const pal = palettes[scheme === "dark" ? "dark" : "light"];
    return { ...base, ...pal, isDark: pal.mode === "dark" };
}

// ─────────────────────────────────────────
// 🧱 GLOBAL STYLES
// ─────────────────────────────────────────

export function useGlobalStyles(t) {
    return StyleSheet.create({
        // Layout
        flex: { flex: 1 },
        screen: { flex: 1, backgroundColor: t.colors.bg, padding: t.spacing.lg },
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        row: { flexDirection: "row", alignItems: "center" },
        spaceBetween: { justifyContent: "space-between" },

        // Typography
        title: {
            fontFamily: t.fontFamily.title,
            fontSize: t.font.xxl,
            lineHeight: t.font.xxl * 1.2,
            color: t.colors.text,
            marginBottom: 8
        },
        subTitle: {
            fontFamily: t.fontFamily.title,
            fontSize: t.font.xl,
            lineHeight: t.font.xl * 1.2,
            color: t.colors.text,
            marginBottom: 8
        },
        body: { fontFamily: t.fontFamily.regular, color: t.colors.text, flex: 1, backgroundColor: t.colors.bg },
        text: { fontFamily: t.fontFamily.regular, fontSize: t.font.md, color: t.colors.text, lineHeight: t.font.md * 1.5,},
        textMuted: { color: t.colors.textMuted },

        // Surfaces
        card: {
            backgroundColor: t.colors.surface,
            borderRadius: t.radius.lg,
            padding: t.spacing.lg,
            borderWidth: 1,
            borderColor: t.colors.border,
            ...t.shadow.card,
        },

        // Input
        input: {
            backgroundColor: t.colors.surface,
            borderRadius: t.radius.md,
            padding: t.spacing.md,
            borderWidth: 1,
            borderColor: t.colors.border,
            color: t.colors.text
        },

        // Screen header
        screenHeader: {
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottomWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.cardBG,
            gap: 15,
        },
        screenHeaderBtn: { paddingVertical: 10, paddingHorizontal: 10 },
        screenHeaderBtnText: { color: t.colors.text, fontFamily: t.fontFamily.title },
        screenHeaderTitle: { fontSize: 18, color: t.colors.text, fontFamily: t.fontFamily.title },

        // Full-bleed cover image
        coverImage: { width: "100%", height: "100%", resizeMode: "cover" },

        // Spacing helpers
        mtSm: { marginTop: t.spacing.sm },
        mtMd: { marginTop: t.spacing.md },
        mtLg: { marginTop: t.spacing.lg },
        mbSm: { marginBottom: t.spacing.sm },
        mbMd: { marginBottom: t.spacing.md },
        mbLg: { marginBottom: t.spacing.lg },
        pSm: { padding: t.spacing.sm },
        pMd: { padding: t.spacing.md },
        pLg: { padding: t.spacing.lg },

        // Utilities
        border: { borderWidth: 1, borderColor: t.colors.border },
        rounded: { borderRadius: t.radius.md },
    });
}

// ─────────────────────────────────────────
// 📸 CAMERA SCREEN
// ─────────────────────────────────────────

export const makeCameraStyles = (t) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: "#000" },

        overlay: {
            ...StyleSheet.absoluteFillObject,
            padding: t.spacing.lg,
            justifyContent: "space-between",
        },

        topBar: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 2,
        },

        glassBtn: {
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.35)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
        },
        iconBtn: { width: 42, height: 42 },

        pill: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
        },
        pillText: { color: "#fff", fontSize: 13 },

        guide: {
            alignSelf: "center",
            width: 240,
            height: 240,
            borderRadius: 28,
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.55)",
            backgroundColor: "rgba(255,255,255,0.04)",
        },

        bottomBar: { alignItems: "center", gap: 12, paddingBottom: 8 },

        captureOuter: {
            width: 84,
            height: 84,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.18)",
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.45)",
            alignItems: "center",
            justifyContent: "center",
        },
        captureInner: {
            width: 64,
            height: 64,
            borderRadius: 999,
            backgroundColor: t.colors.primary,
            alignItems: "center",
            justifyContent: "center",
        },

        hint: { color: "rgba(255,255,255,0.85)", fontSize: 13, textAlign: "center" },
    });

// ─────────────────────────────────────────
// 🏠 HOME SCREEN
// ─────────────────────────────────────────

export const makeHomeStyles = (t) =>
    StyleSheet.create({
        container: { flex: 1, justifyContent: "top", gap: 16 },

        card: {
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.cardBG,
        },
        heroCard: {
            borderRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 70,
            paddingBottom: 22,
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
            marginTop: -90,
            marginBottom: 15,
            zIndex: 2,
            transform: [{ rotate: "-7deg" }]
        },
        badgeText: {
            color: t.colors.textOverPrimary,
            lineHeight: 48,
            fontSize: 28,
            fontFamily: t.fontFamily.logo,
            paddingBottom: 3,
            paddingHorizontal: 20
        },
        subtitle: { color: t.colors.text, opacity: 0.78 },
        featureRow: { flexDirection: "row", flexWrap: "wrap", gap: 17, marginVertical: 10},
        featurePill: {
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            borderColor: t.colors.border,
            backgroundColor: t.colors.cardBG,

        },
        featurePillText: {fontSize: 16, fontFamily: t.fontFamily.title },
        buttons: { gap: 12 },
    });

// ─────────────────────────────────────────
// 🐾 PROFILES LIST SCREEN
// ─────────────────────────────────────────

export const makeProfilesStyles = (t) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: t.colors.bg },

        loading: { color: t.colors.textMuted },

        empty: { flex: 1, padding: 20, alignItems: "center", justifyContent: "center" },
        emptyTitle: { fontSize: 18, color: t.colors.text },
        emptySub: { marginTop: 8, marginBottom: 20, color: t.colors.textMuted, textAlign: "center" },

        list: { padding: 16, paddingBottom: 28, gap: 12 },

        card: {
            borderRadius: 18,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.cardBG,
            padding: 12,

        },
        cardSelected: { borderColor: t.colors.primary, borderWidth: 2 },

        avatarWrap: { width: 70, height: 90 },
        avatar: { width: 70, height: 90, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.06)" },
        avatarFallback: { alignItems: "center", justifyContent: "center" },
        avatarFallbackText: { fontSize: 20, color: "rgba(0,0,0,0.35)" },

        name: { color: t.colors.text, fontSize: 16 },
        sub: { marginTop: 2, color: t.colors.textMuted, fontSize: 12 },

        actions: { alignItems: "flex-end", gap: 8 },

        actionBtnBase: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 10 },
        actionBtnLabel: { fontSize: 12, textAlign: "center", width: 65, fontFamily: t.fontFamily.title },
        actionBtnEdit: { backgroundColor: t.colors.success, fontFamily: t.fontFamily.title },
        actionBtnEditText: { color: t.colors.textOverSuccess, fontFamily: t.fontFamily.title },
        actionBtnDelete: { backgroundColor: t.colors.danger, fontFamily: t.fontFamily.title },
        actionBtnDeleteText: { color: t.colors.textOverDanger, fontFamily: t.fontFamily.title },

        actionSpacing: { marginTop: 10 },
    });

// ─────────────────────────────────────────
// ✏️ EDIT PET SCREEN
// ─────────────────────────────────────────

export const makeEditStyles = (t) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: t.colors.bg },

        content: { paddingHorizontal: 20, paddingVertical: 5 },
        label: { marginTop: 14, marginBottom: 8, color: t.colors.text },

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
            backgroundColor: `${t.colors.danger}0F`,
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

        avatarTitle: { color: t.colors.text },
        avatarSub: { marginTop: 2, color: t.colors.textMuted, fontSize: 13 },

        avatarBtns: { flexDirection: "row", gap: 10 },
        smallBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: t.colors.primary, alignItems: "center" },
        smallBtnSecondary: { backgroundColor: t.colors.secondary },
        smallBtnText: { color: t.colors.textOverPrimary, fontFamily: t.fontFamily.title },
        smallBtnSecondaryText: { color: t.colors.textOverSecondary, fontFamily: t.fontFamily.title },

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
        dropdownText: { color: t.colors.text, fontSize: 16, flex: 1 },
        dropdownChevron: { color: t.colors.textMuted, fontSize: 18, marginLeft: 10 },

        typeRow: {
            marginTop: 20,
            paddingHorizontal: 2,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
        },
        typeLabel: { color: t.colors.textMuted },
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
        typePillText: { color: t.colors.textMuted },

        detectBtn: {
            paddingVertical: 7,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: t.colors.danger,
        },
        detectBtnText: { color: t.colors.textOverDanger, fontFamily: t.fontFamily.title },

        input: {
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: "rgba(255,255,255,0.03)",
            fontSize: 16,
            color: t.colors.text,
            fontFamily: t.fontFamily.regular
        },

        primaryBtn: { marginTop: 18 },
        loading: { color: t.colors.textMuted },

        modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", padding: 18, justifyContent: "center" },
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
        modalTitle: { color: t.colors.text, fontSize: 16 },
        modalClose: { color: t.colors.textMuted },
        modalList: { paddingHorizontal: 8, paddingVertical: 8, flexGrow: 1 },
        modalRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderRadius: 12,
        },
        modalRowSelected: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: t.colors.border },
        modalRowText: { color: t.colors.text },
        modalCheck: { color: t.colors.textMuted },
    });

// ─────────────────────────────────────────
// 💬 ASK / CHAT SCREEN
// ─────────────────────────────────────────

export const makeAskStyles = (t) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: t.colors.bg },
        contentContainer: { flex: 1 },
        cardWrap: { flex: 1, flexDirection: "column" },
        imageWrap: { flex: 1 },
        dismissLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },

        offlineRow: {
            position: "absolute",
            top: 12,
            alignSelf: "center",
            backgroundColor: "rgba(255,255,255,0.9)",
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 20,
            zIndex: 10,
            elevation: 6,
        },
        offlineText: { fontSize: 12, color: "#333" },

        chatOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 },
        chatPanel: { flex: 1, backgroundColor: "rgba(255,255,255,0.4)" },
        chatContent: {
            flexGrow: 1,
            justifyContent: "flex-end",
            gap: 10,
            paddingHorizontal: 20,
            paddingBottom: 15,
        },

        msgRow: { width: "100%", flexDirection: "row" },
        msgRowUser: { justifyContent: "flex-end" },
        msgRowPet: { justifyContent: "flex-start" },

        bubble: { position: "relative", maxWidth: "85%", minWidth: 40, padding: 12, borderRadius: 16 },
        bubbleUser: { backgroundColor: t.colors.primary, borderTopRightRadius: 2 },
        bubblePet: { backgroundColor: t.colors.secondary, borderTopLeftRadius: 2 },
        msgTextUser: { color: t.colors.textOverPrimary, fontSize: 15 },
        msgTextPet: { color: t.colors.textOverSecondary, fontSize: 15 },

        tailBase: {
            position: "absolute",
            top: 0,
            width: 0,
            height: 0,
            borderLeftWidth: 8,
            borderRightWidth: 8,
            borderTopWidth: 12,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
        },
        tailUser: { right: -6, borderTopColor: t.colors.primary },
        tailPet: { left: -6, borderTopColor: t.colors.secondary },

        inputRow: {
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
            padding: 12,
            backgroundColor: t.colors.bg,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
        },
        inputWrap: {
            flex: 1,
            flexShrink: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: t.isDark ? "rgba(255,255,255,0.08)" : "rgba(11,16,32,0.04)",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: t.colors.border,
            paddingHorizontal: 12,
            height: 50,
            gap: 8,
        },
        input: { flex: 1, flexShrink: 1, color: t.colors.text, fontSize: 16 },
        sendBtn: {
            width: 50,
            height: 50,
            borderRadius: 12,
            backgroundColor: t.colors.primary,
            alignItems: "center",
            justifyContent: "center",
            elevation: 4,
        },
    });

// ─────────────────────────────────────────
// 🔍 PREVIEW / THOUGHT SCREEN
// ─────────────────────────────────────────

export const makePreviewStyles = (t) =>
    StyleSheet.create({
        container: { flex: 1 },
        exportWrap: { flex: 1, flexDirection: "column" },
        imageWrap: { flex: 1 },

        bubblePos: { position: "absolute", top: 20, left: 20, right: 20, alignItems: "flex-start" },
        mainButtons: { flexDirection: "row", gap: 10 },

        busyRow: {
            position: "absolute",
            left: 10,
            right: 10,
            bottom: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FFFFFF",
            padding: 10,
            borderRadius: 12,
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
        },
        busyText: { fontSize: 16, textAlign: "center", color: "#2E2E2E" },
    });

// ─────────────────────────────────────────
// 💳 PAYWALL SCREEN
// ─────────────────────────────────────────

export const makePaywallStyles = (t) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: t.colors.bg },
        content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, flexGrow: 1, gap: 12 },

        topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
        topTextWrap: { flex: 1, gap: 2, marginBottom: 10, fontFamily: t.fontFamily.title },
        closeBtn: { width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center",  borderWidth: 1, borderColor: t.colors.border, marginTop: 5 },
        title: { fontSize: 34, color: t.colors.text, lineHeight: 40, fontFamily: t.fontFamily.title },
        emailText: { color: t.colors.textMuted, fontSize: 13 },

        balancePill: { flexDirection: "row", gap: 6, alignItems: "center" },
        balanceText: { color: t.colors.text, fontSize: 15, fontFamily: t.fontFamily.title },

        proCard: {
            padding: 14,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)",
            gap: 10,
        },
        proHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
        proBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: t.colors.primary },
        proBadgeText: { color: t.colors.textOverPrimary, fontSize: 11 },
        proTitle: { color: t.colors.text, fontSize: 20, flex: 1, fontFamily: t.fontFamily.title },
        proSubtitle: { color: t.colors.text, opacity: 0.75, fontSize: 13 },
        benefitsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
        manageSubBtn: { alignItems: "center", paddingVertical: 4 },
        manageSubText: { color: t.colors.text, opacity: 0.5, fontSize: 12, textDecorationLine: "underline" },

        freeCard: {
            padding: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.025)",
            gap: 12,
        },
        freeCardLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
        freeIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.third, alignItems: "center", justifyContent: "center" },
        freeTitle: { color: t.colors.text, fontSize: 20, fontFamily: t.fontFamily.title },
        freeSubtitle: { color: t.colors.text, fontSize: 13, marginTop: 2 },
        freeButton: { height: 41, borderRadius: t.radius.sm, backgroundColor: t.colors.third, alignItems: "center", justifyContent: "center" },
        freeButtonText: { fontSize: 17, fontFamily: t.fontFamily.title, color: t.colors.textOverSecondary },
        rewardStatusText: { color: t.colors.text, fontSize: 13, textAlign: "center", marginTop: 4 },

        sectionHeader: { gap: 2, marginTop: 2 },
        sectionTitle: { color: t.colors.text, fontSize: 22, fontFamily: t.fontFamily.title },
        sectionSub: { color: t.colors.text, fontSize: 13 },
        loadingWrap: { paddingVertical: 18, alignItems: "center", justifyContent: "center" },
        grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
        packCard: {
            width: "48%",
            padding: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
            minHeight: 120,
            justifyContent: "space-between",
        },
        packTitle: { color: t.colors.text, fontSize: 15, fontFamily: t.fontFamily.title },
        packBlurb: { color: t.colors.text, opacity: 0.7, fontSize: 13 },
        buyPill: {
            marginTop: 10,
            paddingHorizontal: 12,
            height: 40,
            borderRadius: t.radius.sm,
            backgroundColor: t.colors.secondary,
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "flex-start",
            width: "100%",
        },
        buyText: { color: t.colors.textOverThird, fontSize: 15, fontFamily: t.fontFamily.title },

        benefitRow: { flexDirection: "row", alignItems: "center", gap: 5 },
        benefitText: { fontSize: 13 },
    });

// ─────────────────────────────────────────
// 🔐 INLINE LOGIN GATE
// ─────────────────────────────────────────

export const makeInlineLoginGateStyles = (t) =>
    StyleSheet.create({
        wrap: { flex: 1, justifyContent: "center", padding: 24 },
        title: { fontSize: 24, color: t.colors.text, marginBottom: 6, fontFamily: t.fontFamily.title },
        newuser: { fontSize: 20, color: t.colors.text, marginBottom: 6 },
        subtitle: { color: t.colors.text, opacity: 0.7, marginTop: 5, marginBottom: 30, lineHeight: 20},
        input: {
            borderWidth: 1,
            borderColor: t.colors.border,
            borderRadius: 16,
            paddingHorizontal: 17,
            paddingVertical: 17,
            color: t.colors.text,
            backgroundColor: t.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
            marginBottom: 12,
        },
        primaryBtn: {
            borderRadius: 16,
            paddingVertical: 15,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.colors.primary,
            marginBottom: 10,
        },
        primaryBtnText: { color: t.colors.textOverPrimary, fontSize: 18, fontFamily: t.fontFamily.title },
        linkText: { textAlign: "center", color: t.colors.text, opacity: 0.75, marginTop: 2, marginBottom: 8 },
        cancelText: { textAlign: "center", color: t.colors.text, opacity: 0.6, marginTop: 8 },
    });

// ─────────────────────────────────────────
// 💳 AUTH CREDITS BAR
// ─────────────────────────────────────────

export const makeAuthCreditsBarStyles = (t) =>
    StyleSheet.create({
        card: {
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.cardBG,
        },
        wrap: { flexDirection: "column" },
        creditsText: {
            fontFamily: t.fontFamily.title,
            fontSize: t.font.xl,
            lineHeight: t.font.xl * 1.2,
            color: t.colors.text
        }
    });

// ─────────────────────────────────────────
// 📊 THOUGHT BOTTOM BAR
// ─────────────────────────────────────────

export const makeThoughtBottomBarStyles = (t) =>
    StyleSheet.create({
        controls: { gap: 10, backgroundColor: t.colors.bg },
        topSlot: { paddingTop: 10, paddingHorizontal: 10, backgroundColor: t.colors.bg },
        shareControls: {
            flexDirection: "row",
            gap: 10,
            padding: 10,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
            backgroundColor: t.colors.bg,
        },
        topIconBtn: {
            flex: 1,
            height: 56,
            borderRadius: t.radius.sm,
            backgroundColor: t.isDark ? "rgba(255,255,255,0.08)" : "rgba(11,16,32,0.06)",
            borderWidth: 1,
            borderColor: t.colors.border,
            alignItems: "center",
            justifyContent: "center",
            gap: 4,

        },
        topIconBtnPressed: { transform: [{ scale: 0.99 }], opacity: 0.95 },
        topIconBtnDisabled: { opacity: 0.5 },
        topIconLabel: { color: t.colors.text, fontSize: 11, fontFamily: t.fontFamily.title },
    });

// ─────────────────────────────────────────
// 🔘 TT BUTTON
// ─────────────────────────────────────────

export const makeTTButtonStyles = (t) =>
    StyleSheet.create({
        base: {
            minHeight: 48,
            paddingHorizontal: t.spacing.xl,
            borderRadius: t.radius.sm,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 10,
        },
        pressed: { transform: [{ scale: 0.99 }], opacity: 0.95 },
        disabled: { opacity: 0.55 },
        primary: { backgroundColor: t.colors.primary },
        primaryText: { color: t.colors.textOverPrimary },
        secondary: { backgroundColor: t.colors.secondary },
        secondaryText: { color: t.colors.textOverSecondary },
        third: { backgroundColor: t.colors.third },
        thirdText: { color: t.colors.textOverThird },
        success: { backgroundColor: t.colors.success },
        successText: { color: t.colors.textOverSuccess },
        danger: { backgroundColor: t.colors.danger },
        dangerText: { color: t.colors.textOverDanger },
        textStyle: { fontSize: t.font.md, fontFamily: t.fontFamily.title },
    });