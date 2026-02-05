import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function SpeechBubble({ text }) {
    return (
        <View style={styles.wrapper}>
            <View style={styles.bubble}>
                <Text style={styles.text}>{text}</Text>
            </View>

            {/* Tail */}
            <View style={styles.tailShadow} />
            <View style={styles.tail} />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        alignItems: "center",
    },

    bubble: {
        width: "100%",
        backgroundColor: "#FFFFFF",
        paddingVertical: 20,
        paddingHorizontal: 20,
        borderRadius: 12,
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
        fontWeight: "400",
    },

    tailShadow: {
        position: "absolute",
        bottom: -12,
        left: '50%',
        marginLeft: -10,
        width: 20,
        height: 20,
        backgroundColor: "#000",
        transform: [{ rotate: "45deg" }],
        opacity: 0.1,
        borderRadius: 3,
    },

    tail: {
        position: "absolute",
        bottom: -8,
        left: '50%',
        width: 20,
        height: 20,
        marginLeft: -10,
        backgroundColor: "#FFFFFF",
        transform: [{ rotate: "45deg" }],
        borderRadius: 3,
    },
});
