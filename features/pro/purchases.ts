import { Platform } from 'react-native';

/**
 * RevenueCat wrapper (Pro-Tier, ADR PRD §7.6): configures the Purchases SDK
 * once per launch when public SDK keys are present (app.config.ts →
 * extra.revenuecat), and answers the single source of truth for Pro access:
 * the `pro` entitlement. rc-* skill rules: public SDK keys only (never the
 * secret REST key), entitlement.isActive is the gate, purchases can be
 * restored. Without keys (dev) the module stays inert and the dev unlock
 * (Firebase session) applies — documented in STATE.md.
 */

export const PRO_ENTITLEMENT = 'pro';

export interface RevenueCatKeys {
  iosKey?: string;
  androidKey?: string;
}

export interface CustomerAccess {
  isPro: boolean;
  /** 'test_store' | 'app_store' | 'play_store' | null — for the UI badge. */
  store: string | null;
}

type PurchasesModule = typeof import('react-native-purchases').default;

let purchases: PurchasesModule | null = null;
let configured = false;

/** Lazy native import (web-safe, like the llama engine). */
async function getPurchases(): Promise<PurchasesModule | null> {
  if (Platform.OS === 'web') return null;
  if (!purchases) {
    purchases = (await import('react-native-purchases')).default;
  }
  return purchases;
}

/** Configures once per launch; returns false when no key exists (dev). */
export async function configurePurchases(keys: RevenueCatKeys): Promise<boolean> {
  if (configured) return true;
  const apiKey = Platform.OS === 'ios' ? keys.iosKey : keys.androidKey;
  if (!apiKey) return false;
  const module = await getPurchases();
  if (!module) return false;
  module.configure({ apiKey });
  configured = true;
  return true;
}

/** Entitlement check — the ONLY gate for Pro features (rc-subscription-states). */
export async function getCustomerAccess(): Promise<CustomerAccess> {
  const module = await getPurchases();
  if (!module || !configured) return { isPro: false, store: null };
  const info = await module.getCustomerInfo();
  const entitlement = info.entitlements.active[PRO_ENTITLEMENT];
  return { isPro: entitlement !== undefined, store: entitlement?.store ?? null };
}

export interface ProPackage {
  identifier: string;
  priceString: string;
  /** 'monthly' | 'annual' | other — for the toggle UI. */
  period: 'monthly' | 'annual' | 'other';
}

/** Current offering's packages for the paywall (rc-purchase-flow). */
export async function getProPackages(): Promise<ProPackage[]> {
  const module = await getPurchases();
  if (!module || !configured) return [];
  const offerings = await module.getOfferings();
  const current = offerings.current;
  if (!current) return [];
  return current.availablePackages.map((pkg) => ({
    identifier: pkg.identifier,
    priceString: pkg.product.priceString,
    period:
      pkg.identifier === '$rc_monthly'
        ? 'monthly'
        : pkg.identifier === '$rc_annual'
          ? 'annual'
          : 'other',
  }));
}

/** Purchase by package identifier; returns the resulting access state. */
export async function purchasePackage(identifier: string): Promise<CustomerAccess> {
  const module = await getPurchases();
  if (!module || !configured) throw new Error('RevenueCat ist nicht konfiguriert');
  const offerings = await module.getOfferings();
  const pkg = offerings.current?.availablePackages.find(
    (candidate) => candidate.identifier === identifier,
  );
  if (!pkg) throw new Error(`Paket ${identifier} nicht im Offering`);
  const result = await module.purchasePackage(pkg);
  const entitlement = result.customerInfo.entitlements.active[PRO_ENTITLEMENT];
  return { isPro: entitlement !== undefined, store: entitlement?.store ?? null };
}

/** Restore purchases (Play/App Store re-installs, rc-purchase-flow). */
export async function restorePurchases(): Promise<CustomerAccess> {
  const module = await getPurchases();
  if (!module || !configured) throw new Error('RevenueCat ist nicht konfiguriert');
  const info = await module.restorePurchases();
  const entitlement = info.entitlements.active[PRO_ENTITLEMENT];
  return { isPro: entitlement !== undefined, store: entitlement?.store ?? null };
}
