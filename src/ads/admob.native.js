import React from "react";
import { View } from "react-native";
import mobileAds, { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

let _inited = false;

export function initAdsOnce() {
    if (_inited) return;
    _inited = true;
    mobileAds().initialize().catch(() => {});
}

// ✅ Put your REAL banner unit id here (for production)
const BANNER_UNIT_ID = "ca-app-pub-5887472906492199~1304327748"; // TODO: replace with your AdMob Banner unit id

export function PreviewBannerAd({ enabled = true, refreshKey = "0" }) {
    if (!enabled) return null;

    const unitId = __DEV__ ? TestIds.BANNER : BANNER_UNIT_ID;

    return (
        <View style={{ alignItems: "center" }}>
            {/* key forces a remount → new ad request */}
            <BannerAd
                key={`preview-banner-${refreshKey}`}
                unitId={unitId}
                size={BannerAdSize.BANNER} // 320x50 typical on phones
            />
        </View>
    );
}
