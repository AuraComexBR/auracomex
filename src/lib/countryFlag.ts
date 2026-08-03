import { resolveCountryCode } from './countries';

/**
 * Convert a country value to an emoji flag. Accepts either a clean 2-letter
 * ISO code ("BR") or a legacy free-form value (a pt-BR country name like
 * "Brasil", or an abbreviation like "EUA") — it resolves either case to the
 * correct code before building the flag, so old/mismatched data doesn't
 * render the wrong country.
 * e.g. "BR" → "🇧🇷", "Estados Unidos" → "🇺🇸"
 */
export function countryCodeToFlag(code: string): string {
  const resolved = resolveCountryCode(code);
  if (!resolved || resolved.length !== 2) return '';
  return String.fromCodePoint(
    ...resolved.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/**
 * Extract country code from a port string like "BRSSZ - Santos, BR" or "Santos, BR"
 * Returns the 2-letter code or empty string.
 */
export function extractCountryFromPort(port: string): string {
  if (!port) return '';
  // Try format "XXYYY" (UN/LOCODE prefix)
  const locode = port.match(/^([A-Z]{2})\w{3}/);
  if (locode) return locode[1];
  // Try ", XX" at end
  const suffix = port.match(/,\s*([A-Z]{2})\s*$/i);
  if (suffix) return suffix[1].toUpperCase();
  return '';
}
