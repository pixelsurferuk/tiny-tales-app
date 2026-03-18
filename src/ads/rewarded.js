import Constants from "expo-constants";
import { REWARDED_AD_UNIT_IDS } from "../config";

let RewardedAd = null;
let RewardedAdEventType = null;
let AdEventType = null;
let TestIds = null;
let Platform = null;

const isExpoGo = Constants.appOwnership === "expo";

if (!isExpoGo) {
    Platform = require("react-native").Platform;
    const ads = require("react-native-google-mobile-ads");
    RewardedAd = ads.RewardedAd;
    RewardedAdEventType = ads.RewardedAdEventType;
    AdEventType = ads.AdEventType;
    TestIds = ads.TestIds;
}

function resolveRewardedUnitId() {
    if (!Platform || !TestIds) return null;
    if (__DEV__) return TestIds.REWARDED;
    return Platform.OS === "ios" ? REWARDED_AD_UNIT_IDS.ios : REWARDED_AD_UNIT_IDS.android;
}

export function canUseRewardedAds() {
    return !isExpoGo && !!RewardedAd;
}

export function showRewardedAd({ onRewardEarned, onClosed, onError, ssvUserId, ssvCustomData }) {
    if (!canUseRewardedAds()) {
        onError?.(new Error("Rewarded ads require a development build. Expo Go is not supported."));
        return () => {};
    }

    const rewarded = RewardedAd.createForAdRequest(resolveRewardedUnitId(), {
        requestNonPersonalizedAdsOnly: true,
        ...(ssvUserId || ssvCustomData
            ? {
                serverSideVerificationOptions: {
                    ...(ssvUserId ? { userId: String(ssvUserId) } : {}),
                    ...(ssvCustomData ? { customData: String(ssvCustomData) } : {}),
                },
            }
            : {}),
    });

    let rewardEarned = false;

    const unsubLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        rewarded.show();
    });

    const unsubReward = rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward) => {
            rewardEarned = true;
            onRewardEarned?.(reward);
        }
    );

    const unsubClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        cleanup();
        onClosed?.({ rewardEarned });
    });

    const unsubError = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
        cleanup();
        onError?.(error);
    });

    function cleanup() {
        try {
            unsubLoaded();
            unsubReward();
            unsubClosed();
            unsubError();
        } catch {}
    }

    rewarded.load();

    return cleanup;
}