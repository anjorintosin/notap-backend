const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_VALIDITY_DAYS = 365;

function parseDate(value?: Date | string | null): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Calendar days between effective and expiry (agreement term length). */
export function getAgreementValidityDays(
  effectiveDate?: Date | string | null,
  expiryDate?: Date | string | null,
): number | null {
  const effective = parseDate(effectiveDate);
  const expiry = parseDate(expiryDate);
  if (!effective || !expiry) return null;

  const start = startOfDay(effective);
  const end = startOfDay(expiry);
  const days = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  return days > 0 ? days : null;
}

export function addCalendarDays(date: Date, days: number): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Certificate period from agreement dates: anchor (e.g. payment/renewal day) + same span as
 * effective→expiry on the submission. Falls back to 1 year when dates are missing or invalid.
 */
export function computeCertificateDatesFromAgreement(
  effectiveDate?: Date | string | null,
  expiryDate?: Date | string | null,
  anchor: Date = new Date(),
): { effectiveDate: Date; expiryDate: Date } {
  const validityDays = getAgreementValidityDays(effectiveDate, expiryDate);
  const effective = startOfDay(anchor);

  if (validityDays != null) {
    return {
      effectiveDate: effective,
      expiryDate: addCalendarDays(effective, validityDays),
    };
  }

  return {
    effectiveDate: effective,
    expiryDate: addCalendarDays(effective, DEFAULT_VALIDITY_DAYS),
  };
}

export function applyRenewalCertificateDates(
  sub: { effectiveDate?: Date | string | null; expiryDate?: Date | string | null },
  anchor: Date = new Date(),
): { effectiveDate: Date; expiryDate: Date } {
  return computeCertificateDatesFromAgreement(sub.effectiveDate, sub.expiryDate, anchor);
}
