/**
 * Payee identity for remembered categories.
 *
 * "SWIGGY", "Swiggy Ltd." and "swiggy-ltd" are the same payee to a person, so
 * the key is lowercased with every run of non-alphanumerics collapsed to a
 * single space. Bank SMS spell the same merchant inconsistently, and without
 * this the memory would miss on almost every second message.
 */
export function merchantKey(merchant: unknown): string | null {
  if (typeof merchant !== 'string') return null;
  const key = merchant.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return key ? key.slice(0, 80) : null;
}
