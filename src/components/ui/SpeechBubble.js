import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function SpeechBubble({ text, customContent }) {
    return (
        <View style={styles.wrapper}>
            <View style={styles.bubble}>
                {customContent ?? <Text style={styles.text}>{text}</Text>}
            </View>
            {/* Thought bubble tail — three circles descending */}
            <View style={styles.dot1} />
            <View style={styles.dot2} />
            <View style={styles.dot3} />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        alignItems: "center",
        paddingBottom: 28, // room for the thought dots
    },

    bubble: {
        width: "100%",
        backgroundColor: "#FFFFFF",
        paddingVertical: 20,
        paddingHorizontal: 20,
        borderRadius: 30,
        shadowColor: "#000",
        shadowOpacity: 0.30,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6, // Android
    },

    text: {
        fontSize: 16,
        lineHeight: 22,
        textAlign: "center",
        color: "#2E2E2E",
        fontFamily: "Nunito_400Regular",
    },

    // Large dot — closest to bubble
    dot1: {
        position: "absolute",
        bottom: 10,
        right: "55%",
        width: 40,
        height: 40,
        borderRadius: 999,
        backgroundColor: "#FFFFFF",
    },

    // Medium dot
    dot2: {
        position: "absolute",
        bottom: -15,
        right: "48%",
        width: 30,
        height: 30,
        borderRadius: 999,
        backgroundColor: "#FFFFFF",
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
    },

    // Small dot — furthest from bubble
    dot3: {
        position: "absolute",
        bottom: -30,
        right: "43%",
        width: 15,
        height: 15,
        borderRadius: 999,
        backgroundColor: "#FFFFFF",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 1,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
    },
});