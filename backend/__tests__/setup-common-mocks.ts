import { vi } from "vitest";

export function setupCommonMocks(): void {
  vi.mock("../src/utils/logger", () => ({
    __esModule: true,
    default: {
      error: console.error,
      warning: console.warn,
      info: console.info,
      success: console.info,
      logToDb: console.info,
    },
  }));

  vi.mock("swagger-stats", () => ({
    getMiddleware:
      () =>
      (_: unknown, __: unknown, next: () => unknown): void => {
        next();
      },
  }));
}
