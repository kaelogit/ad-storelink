/**
 * Supported countries for StoreLink (Paystack markets).
 * Used by admin dashboard for country filtering.
 */
export interface SupportedCountry {
  name: string;
  code: string;
  currency: string;
  flag: string;
}

/** Sentinel for "All Countries" - use when financial metrics must be hidden (mixed currency trap) */
export const ALL_COUNTRIES_CODE = 'ALL'

export const SUPPORTED_COUNTRIES: SupportedCountry[] = [
  { name: 'All Countries', code: ALL_COUNTRIES_CODE, currency: '', flag: '🌐' },
  { name: 'Nigeria', code: 'NG', currency: 'NGN', flag: '🇳🇬' },
  { name: 'Ghana', code: 'GH', currency: 'GHS', flag: '🇬🇭' },
  { name: 'South Africa', code: 'ZA', currency: 'ZAR', flag: '🇿🇦' },
  { name: 'Kenya', code: 'KE', currency: 'KES', flag: '🇰🇪' },
  { name: "Côte d'Ivoire", code: 'CI', currency: 'XOF', flag: '🇨🇮' },
  { name: 'Egypt', code: 'EG', currency: 'EGP', flag: '🇪🇬' },
  { name: 'Rwanda', code: 'RW', currency: 'RWF', flag: '🇷🇼' },
];

export const DEFAULT_COUNTRY_CODE = 'NG';

export function getCountryByCode(code: string): SupportedCountry | undefined {
  return SUPPORTED_COUNTRIES.find((c) => c.code === code);
}
