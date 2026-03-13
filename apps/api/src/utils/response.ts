export function nowIso(): string {
  return new Date().toISOString();
}

export function okSource(rippled: string) {
  return {
    rippled,
    ts: nowIso()
  };
}

export function errorBody(error: string) {
  return {
    ok: false,
    error
  };
}
