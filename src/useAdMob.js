import { AdMob, BannerAdSize, BannerAdPosition } from "@capacitor-community/admob";
import { Capacitor } from "@capacitor/core";

const BANNER_ID            = "ca-app-pub-4175062533825097/4087045350";
const REWARDED_ID          = "ca-app-pub-4175062533825097/1018504246";
const REWARDED_COACH_IA_ID = "ca-app-pub-4175062533825097/9892481352";
const INTERSTITIAL_ID      = "ca-app-pub-4175062533825097/5185785864";

// En desarrollo (npm run dev) usa anuncios de prueba.
// En producción (npm run build) usa anuncios reales.
const IS_TESTING = import.meta.env.DEV || import.meta.env.VITE_ADMOB_TESTING === "true";

let bannerLoadedListener = null;
let bannerSizeListener   = null;
let initialized = false;

export async function initAdMob() {
  if (!Capacitor.isNativePlatform()) return;
  if (initialized) return;
  initialized = true;
  await AdMob.initialize({ requestTrackingAuthorization: false });
  if (bannerLoadedListener) { bannerLoadedListener.remove(); bannerLoadedListener = null; }
  if (bannerSizeListener)   { bannerSizeListener.remove();   bannerSizeListener = null; }
  bannerLoadedListener = await AdMob.addListener("bannerAdLoaded", (info) => {
    const height = info?.adSize?.height || 50;
    document.body.style.paddingBottom = `${height + 8}px`;
    document.documentElement.style.setProperty("--banner-height", `${height + 8}px`);
  });
  bannerSizeListener = await AdMob.addListener("bannerAdSizeChanged", (info) => {
    const height = info?.adSize?.height || 50;
    document.body.style.paddingBottom = `${height + 8}px`;
    document.documentElement.style.setProperty("--banner-height", `${height + 8}px`);
  });
}

export async function showBanner() {
  if (!Capacitor.isNativePlatform()) return;
  await AdMob.showBanner({
    adId: BANNER_ID,
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    margin: 0,
    isTesting: IS_TESTING,
  });
  document.body.style.paddingBottom = "70px";
  document.documentElement.style.setProperty("--banner-height", "70px");
}

export async function hideBanner() {
  if (!Capacitor.isNativePlatform()) return;
  try { await AdMob.hideBanner(); } catch {}
  document.body.style.paddingBottom = "0px";
  document.documentElement.style.setProperty("--banner-height", "0px");
}

export async function removeBanner() {
  if (!Capacitor.isNativePlatform()) return;
  try { await AdMob.removeBanner(); } catch {}
  document.body.style.paddingBottom = "0px";
  document.documentElement.style.setProperty("--banner-height", "0px");
}

export async function showInterstitial() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_ID, isTesting: IS_TESTING });
    await AdMob.showInterstitial();
  } catch (e) { console.error("Interstitial error:", e); }
}

export async function showRewardedAd() {
  if (!Capacitor.isNativePlatform()) return true;
  return new Promise(async (resolve) => {
    let rewardEarned = false;
    let rewardListener, closeListener, failListener;
    rewardListener = await AdMob.addListener("onRewardedVideoAdReward", () => { rewardEarned = true; });
    closeListener  = await AdMob.addListener("onRewardedVideoAdDismissed", () => {
      rewardListener?.remove(); closeListener?.remove(); failListener?.remove(); resolve(rewardEarned);
    });
    failListener = await AdMob.addListener("onRewardedVideoAdFailedToLoad", (e) => {
      console.error("Rewarded ad failed:", e);
      rewardListener?.remove(); closeListener?.remove(); failListener?.remove(); resolve(false);
    });
    try {
      await AdMob.prepareRewardVideoAd({ adId: REWARDED_ID, isTesting: IS_TESTING });
      await AdMob.showRewardVideoAd();
    } catch (e) {
      console.error("Rewarded error:", e);
      rewardListener?.remove(); closeListener?.remove(); resolve(false);
    }
  });
}

export async function showCoachIARewardedAd() {
  if (!Capacitor.isNativePlatform()) return true;
  return new Promise(async (resolve) => {
    let rewardEarned = false;
    let rewardListener, closeListener, failListener;
    rewardListener = await AdMob.addListener("onRewardedVideoAdReward", () => { rewardEarned = true; });
    closeListener  = await AdMob.addListener("onRewardedVideoAdDismissed", () => {
      rewardListener?.remove(); closeListener?.remove(); failListener?.remove(); resolve(rewardEarned);
    });
    failListener   = await AdMob.addListener("onRewardedVideoAdFailedToLoad", (e) => {
      console.error("Coach IA rewarded ad failed:", e);
      rewardListener?.remove(); closeListener?.remove(); failListener?.remove(); resolve(false);
    });
    try {
      await AdMob.prepareRewardVideoAd({ adId: REWARDED_COACH_IA_ID, isTesting: IS_TESTING });
      await AdMob.showRewardVideoAd();
    } catch (e) {
      console.error("Coach IA rewarded error:", e);
      rewardListener?.remove(); closeListener?.remove(); failListener?.remove(); resolve(false);
    }
  });
}