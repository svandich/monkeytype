/**
 * Analytics are disabled. Kept as a no-op so callers don't need to change.
 */
export async function log(
  _eventName: string,
  _params?: Record<string, string>,
): Promise<void> {
  //
}

export function activateAnalytics(): void {
  //
}
