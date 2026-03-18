import React from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { SHARE_CAPTION_HEADLINE, SHARE_CAPTION_BODY } from "../../config";

function getShareCaption() {
    const store = Platform.OS === "ios" ? "the App Store" : "Google Play";
    return {
        headline: SHARE_CAPTION_HEADLINE,
        body: SHARE_CAPTION_BODY.replace("{store}", store),
    };
}

export default function ShareCaptionBar() {
    const caption = getShareCaption();

    return (
        <View style={styles.captionBar}>
            <View style={styles.captionIconWrap}>
                <Image
                    source={require("../../../assets/images/icon.png")}
                    style={styles.captionIcon}
                />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.captionHeadline}>{caption.headline}</Text>
                <Text style={styles.captionText}>{caption.body}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    captionBar: {
        backgroundColor: "#FFFFFF",
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: "row",
        gap: 12,
    },
    captionIconWrap: {
        width: 55,
        height: 55,
        borderRadius: 10,
        overflow: "hidden",
    },
    captionIcon: {
        width: 55,
        height: 55,
    },
    captionHeadline: {
        color: "#1B1F2A",
        fontSize: 13,
        lineHeight: 18,
        fontWeight: "700",
        marginBottom: 4,
    },
    captionText: {
        color: "#1B1F2A",
        fontSize: 13,
        lineHeight: 18,
        opacity: 0.85,
    },
});
