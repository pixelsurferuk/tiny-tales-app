// src/components/ui/TTAlert.js
import React, { createContext, useContext, useState, useCallback } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { useTTTheme } from "../../theme/globalStyles";

const AlertContext = createContext(null);

export function TTAlertProvider({ children }) {
    const [config, setConfig] = useState(null);

    const show = useCallback((title, message, buttons = [{ text: "OK" }]) => {
        setConfig({ title, message, buttons });
    }, []);

    const dismiss = useCallback(() => setConfig(null), []);

    return (
        <AlertContext.Provider value={show}>
            {children}
            {config && (
                <TTAlertModal
                    {...config}
                    onDismiss={dismiss}
                />
            )}
        </AlertContext.Provider>
    );
}

export function useTTAlert() {
    return useContext(AlertContext);
}

function TTAlertModal({ title, message, buttons, onDismiss }) {
    const t = useTTTheme();
    const s = makeStyles(t);

    return (
        <Modal transparent animationType="fade" visible onRequestClose={onDismiss}>
            <View style={s.backdrop}>
                <View style={s.card}>
                    {!!title && <Text style={s.title}>{title}</Text>}
                    {!!message && <Text style={s.message}>{message}</Text>}

                    <View style={[s.btnRow, buttons.length > 2 && s.btnCol]}>
                        {buttons.map((btn, i) => {
                            const isDestructive = btn.style === "destructive";
                            const isCancel = btn.style === "cancel";
                            return (
                                <Pressable
                                    key={i}
                                    style={({ pressed }) => [
                                        s.btn,
                                        isDestructive && s.btnDestructive,
                                        isCancel && s.btnCancel,
                                        pressed && s.btnPressed,
                                    ]}
                                    onPress={() => {
                                        onDismiss();
                                        btn.onPress?.();
                                    }}
                                >
                                    <Text style={[
                                        s.btnText,
                                        isDestructive && s.btnTextDestructive,
                                        isCancel && s.btnTextCancel,
                                    ]}>
                                        {btn.text}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (t) => StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
    },
    card: {
        width: "100%",
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.cardBG,
        padding: 24,
        gap: 8,
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
    },
    title: {
        fontFamily: t.fontFamily.title,
        fontSize: t.font.lg,
        color: t.colors.text,
        textAlign: "center",
    },
    message: {
        color: t.colors.textMuted,
        textAlign: "center",
        lineHeight: 22,
    },
    btnRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 8,
    },
    btnCol: {
        flexDirection: "column",
    },
    btn: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: t.radius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: t.colors.primary,
    },
    btnDestructive: {
        backgroundColor: t.colors.danger,
    },
    btnCancel: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: t.colors.border,
    },
    btnPressed: {
        opacity: 0.85,
        transform: [{ scale: 0.98 }],
    },
    btnText: {
        color: t.colors.textOverPrimary,
    },
    btnTextDestructive: {
        color: t.colors.textOverDanger,
    },
    btnTextCancel: {
        color: t.colors.textMuted,
    },
});