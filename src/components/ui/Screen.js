import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTTTheme } from "../../theme/globalStyles";

export default function Screen({ children, style, edges = ["top", "bottom"] }) {
    const t = useTTTheme();
    return (
        <SafeAreaView style={[{ flex: 1, backgroundColor: t.colors.bg }, style]} edges={edges}>
            {children}
        </SafeAreaView>
    );
}