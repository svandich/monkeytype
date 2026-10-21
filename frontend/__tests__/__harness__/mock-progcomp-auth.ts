import { vi } from "vitest";
vi.mock("../../src/ts/progcomp-auth", () => ({
  getAuthenticatedUser: () => null,
  getIdToken: async () => null,
  isAuthAvailable: () => false,
}));
