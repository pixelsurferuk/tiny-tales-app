// src/components/auth/LoginGateButton.js
import React, { useState } from "react";
import { Modal } from "react-native";
import { useAuth } from "../../state/auth";
import TTButton from "../ui/TTButton";
import InlineLoginGate from "./InlineLoginGate";
import { useTTTheme, makePaywallStyles } from "../../theme/globalStyles";
import Screen from "../ui/Screen";
import {Ionicons} from "@expo/vector-icons";

export default function LoginGateButton({
        title = "Sign In",
        variant = "primary",
        style,
        iconTop,
        iconLeft,
        iconRight,
        disabled = false,
        onSuccess,
        gateTitle = "Sign in to continue",
        gateSubtitle = "Sign in to unlock purchases and keep everything safe across devices.",
    }) {
    const t = useTTTheme();
    const styles = makePaywallStyles(t);
    const { isLoggedIn } = useAuth();
    const [showGate, setShowGate] = useState(false);

    if (isLoggedIn) return null;

    const handleSuccess = () => {
        setShowGate(false);
        onSuccess?.();
    };

    return (
        <>
            <TTButton
                title={title}
                variant={variant}
                style={style}
                iconTop={iconTop}
                iconLeft={iconLeft}
                iconRight={iconRight}
                disabled={disabled}
                onPress={() => setShowGate(true)}
            />

            <Modal
                visible={showGate}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowGate(false)}
            >
                <Screen style={styles.container} edges={["top", "bottom"]}>
                    <InlineLoginGate
                        title={gateTitle}
                        subtitle={gateSubtitle}
                        cancelTo={null}
                        onSuccess={handleSuccess}
                        onCancel={() => setShowGate(false)}
                    />
                </Screen>
            </Modal>
        </>
    );
}