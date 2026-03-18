import React from "react";
import { View, Platform } from "react-native";
import Constants from "expo-constants";
import { BANNER_AD_UNIT_IDS } from "../config";
import { useTTTheme } from "../theme";

const isExpoGo = Constants.appOwnership === "expo";

// Conditionally require — top-level import crashes in Expo Go
let BannerAd       = null;
let BannerAdSize   = null;
let TestIds        = null;

if (!isExpoGo) {
    const ads  = require("react-native-google-mobile-ads");
    BannerAd     = ads.BannerAd;
    BannerAdSize = ads.BannerAdSize;
    TestIds      = ads.TestIds;
}

function resolveUnitId() {
    if (!TestIds) return null;
    if (__DEV__) return TestIds.BANNER;
    return Platform.OS === "ios" ? BANNER_AD_UNIT_IDS.ios : BANNER_AD_UNIT_IDS.android;
}

const adCallbacks = __DEV__
    ? {
        onAdLoaded:       ()  => console.log("[ads] banner loaded"),
        onAdFailedToLoad: (e) => console.warn("[ads] banner failed", e?.code, e?.message),
    }
    : {};

export function AppBannerAd({ enabled = true, refreshKey }) {
    const t = useTTTheme();

    if (!enabled || isExpoGo || !BannerAd) return null;

    const unitId = resolveUnitId();
    if (!unitId) return null;

    return (
        <View
            key={refreshKey}
            style={{ alignItems: "center", minHeight: 60, backgroundColor: t.colors.bg }}
        >
            <BannerAd
                unitId={unitId}
                size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                requestOptions={{ requestNonPersonalizedAdsOnly: true }}
                {...adCallbacks}
            />
        </View>
    );
}

export const PreviewBannerAd = AppBannerAd;