/**
 * Google Mobile Ads Consent & Initialization Manager
 *
 * Implements Google User Messaging Platform (UMP) consent flows,
 * handles GDPR/CCPA regulatory requirements, and safely initializes the Mobile Ads SDK.
 */

import mobileAds, {
  AdsConsent,
  AdsConsentStatus,
  AdsConsentPrivacyOptionsRequirementStatus,
  AdsConsentInfo,
  AdsConsentDebugGeography,
} from 'react-native-google-mobile-ads';
import { getAdConfig } from './adConfig';

export interface AdConsentState {
  isInitialized: boolean;
  canRequestAds: boolean;
  consentStatus: AdsConsentStatus | 'UNCHECKED';
  isPrivacyOptionsRequired: boolean;
  error: string | null;
}

class AdConsentManager {
  private isInitializing = false;
  private isInitialized = false;
  private canRequestAdsFlag = false;
  private isPrivacyOptionsAvailable = false;
  private currentStatus: AdsConsentStatus | 'UNCHECKED' = 'UNCHECKED';

  getState(): AdConsentState {
    return {
      isInitialized: this.isInitialized,
      canRequestAds: this.canRequestAdsFlag,
      consentStatus: this.currentStatus,
      isPrivacyOptionsRequired: this.isPrivacyOptionsAvailable,
      error: null,
    };
  }

  getCanRequestAds(): boolean {
    return this.canRequestAdsFlag;
  }

  isSdkInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Initializes consent collection and AdMob SDK.
   * Safe to call multiple times; subsequent calls return the existing promise.
   * Runs non-blockingly so app startup and video playback are never stalled.
   */
  async initializeConsentAndAds(options?: {
    debugGeography?: AdsConsentDebugGeography;
    testDeviceIdentifiers?: string[];
  }): Promise<AdConsentState> {
    if (this.isInitialized) {
      return this.getState();
    }

    if (this.isInitializing) {
      // Avoid duplicate parallel initialization runs
      return this.getState();
    }

    const config = getAdConfig();
    if (!config.isAdsEnabled) {
      console.log('[AdConsentManager] Ads are disabled by configuration.');
      return this.getState();
    }

    this.isInitializing = true;

    try {
      // 1. Request updated consent information from Google UMP
      const consentOptions = options ? { ...options } : undefined;
      let consentInfo: AdsConsentInfo;

      try {
        consentInfo = await AdsConsent.requestInfoUpdate(consentOptions);
        this.currentStatus = consentInfo.status;
        this.isPrivacyOptionsAvailable =
          consentInfo.privacyOptionsRequirementStatus ===
          AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;

        console.log(
          `[AdConsentManager] Consent status: ${consentInfo.status}, ` +
            `canRequestAds: ${consentInfo.canRequestAds}, ` +
            `formAvailable: ${consentInfo.isConsentFormAvailable}`
        );

        // 2. Present Google-rendered consent form if required by regulations (e.g. EEA/GDPR)
        if (
          consentInfo.isConsentFormAvailable &&
          (consentInfo.status === AdsConsentStatus.REQUIRED ||
            consentInfo.status === AdsConsentStatus.UNKNOWN)
        ) {
          const formResult = await AdsConsent.loadAndShowConsentFormIfRequired();
          this.currentStatus = formResult.status;
          this.canRequestAdsFlag = formResult.canRequestAds;
        } else {
          this.canRequestAdsFlag = consentInfo.canRequestAds;
        }
      } catch (consentErr: any) {
        // If UMP consent fails (e.g., offline or network error), safely inspect last known state
        console.warn(
          '[AdConsentManager] UMP consent request notice (offline or skipped):',
          consentErr?.message || consentErr
        );
        try {
          const fallbackInfo = await AdsConsent.getConsentInfo();
          this.canRequestAdsFlag = fallbackInfo.canRequestAds;
          this.currentStatus = fallbackInfo.status;
        } catch {
          // If completely unresolvable, allow non-personalized or test ads in development
          this.canRequestAdsFlag = config.isTestMode;
        }
      }

      // 3. Initialize Mobile Ads SDK if consent permits ad serving
      if (this.canRequestAdsFlag) {
        try {
          const initStatus = await mobileAds().initialize();
          this.isInitialized = true;
          console.log('[AdConsentManager] Google Mobile Ads SDK successfully initialized.', initStatus);
        } catch (initErr: any) {
          console.warn('[AdConsentManager] Google Mobile Ads initialization error:', initErr?.message || initErr);
        }
      } else {
        console.log('[AdConsentManager] Consent policy restricts ad requests. Ads will remain suppressed.');
      }
    } catch (globalErr: any) {
      console.warn('[AdConsentManager] Unexpected error during consent/ad setup:', globalErr?.message || globalErr);
    } finally {
      this.isInitializing = false;
    }

    return this.getState();
  }

  /**
   * Shows privacy options form on demand (e.g., from Settings screen)
   * so users in EEA/UK can modify their consent preferences at any time.
   */
  async showPrivacyOptions(): Promise<boolean> {
    try {
      console.log('[AdConsentManager] Presenting privacy options form to user...');
      const result = await AdsConsent.showPrivacyOptionsForm();
      this.canRequestAdsFlag = result.canRequestAds;
      this.currentStatus = result.status;
      return true;
    } catch (err: any) {
      console.warn('[AdConsentManager] Privacy options form could not be shown:', err?.message || err);
      return false;
    }
  }

  /**
   * Resets consent state (useful for QA / testing consent dialogs)
   */
  async resetConsentForTesting(): Promise<void> {
    try {
      await AdsConsent.reset();
      this.isInitialized = false;
      this.canRequestAdsFlag = false;
      this.currentStatus = 'UNCHECKED';
      console.log('[AdConsentManager] Consent reset successfully for testing.');
    } catch (err: any) {
      console.warn('[AdConsentManager] Consent reset failed:', err?.message || err);
    }
  }
}

export const adConsentManager = new AdConsentManager();
