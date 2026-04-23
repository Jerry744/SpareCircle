// Shared result envelope for v2 parsers.
// Legacy v1 parsers use variant-named fields (`project`, `widget`, ...) which
// we keep untouched; new v2 parsers standardize on `value` per
// `01-data-model.md` §6.

export type ParseResult<T> =
  | { ok: true; value: T; warning?: string }
  | { ok: false; error: string };

export function parseOk<T>(value: T, warning?: string): ParseResult<T> {
  return warning ? { ok: true, value, warning } : { ok: true, value };
}

export function parseFail<T>(error: string): ParseResult<T> {
  return { ok: false, error };
}

export function combineWarnings(
  primary: string | undefined,
  extra: string | undefined,
): string | undefined {
  if (!primary) return extra;
  if (!extra) return primary;
  return `${primary}\n${extra}`;
}
