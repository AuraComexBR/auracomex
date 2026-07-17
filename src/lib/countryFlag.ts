/**
 * Convert a 2-letter ISO country code to an emoji flag.
 * e.g. "BR" → "🇧🇷", "US" → "🇺🇸"
 */
export function countryCodeToFlag(code: string): string {
  if (!code || code.length < 2) return '';
  const upper = code.toUpperCase().slice(0, 2);
  return String.fromCodePoint(
    ...upper.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
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
