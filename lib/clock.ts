let override: Date | null = null;

/** Current time. Tests can freeze it with setClock(). */
export function now(): Date {
  return override ? new Date(override) : new Date();
}

export function setClock(date: Date | null) {
  override = date;
}
