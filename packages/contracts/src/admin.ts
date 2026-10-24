import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { IdSchema } from "@monkeytype/schemas/util";
import {
  CommonResponses,
  meta,
  MonkeyResponseSchema,
  responseWithData,
} from "./util/api";

export const ToggleBanRequestSchema = z
  .object({
    uid: IdSchema,
  })
  .strict();
export type ToggleBanRequest = z.infer<typeof ToggleBanRequestSchema>;

export const ClearStreakHourOffsetRequestSchema = z
  .object({
    uid: IdSchema,
  })
  .strict();
export type ClearStreakHourOffsetRequest = z.infer<
  typeof ClearStreakHourOffsetRequestSchema
>;

export const ToggleBanResponseSchema = responseWithData(
  z.object({
    banned: z.boolean(),
  }),
).strict();
export type ToggleBanResponse = z.infer<typeof ToggleBanResponseSchema>;

export const DeleteUserRequestSchema = z
  .object({
    uid: IdSchema,
  })
  .strict();
export type DeleteUserRequest = z.infer<typeof DeleteUserRequestSchema>;

export const AcceptReportsRequestSchema = z
  .object({
    reports: z.array(z.object({ reportId: z.string() }).strict()).nonempty(),
  })
  .strict();
export type AcceptReportsRequest = z.infer<typeof AcceptReportsRequestSchema>;

export const RejectReportsRequestSchema = z
  .object({
    reports: z
      .array(
        z
          .object({ reportId: z.string(), reason: z.string().optional() })
          .strict(),
      )
      .nonempty(),
  })
  .strict();
export type RejectReportsRequest = z.infer<typeof RejectReportsRequestSchema>;

export const SendForgotPasswordEmailRequestSchema = z
  .object({
    email: z.string().email(),
  })
  .strict();
export type SendForgotPasswordEmailRequest = z.infer<
  typeof SendForgotPasswordEmailRequestSchema
>;

export const AdminReportSchema = z.object({
  id: z.string(),
  type: z.enum(["quote", "user"]),
  timestamp: z.number().int().nonnegative(),
  uid: z.string(),
  reporterName: z.string().optional(),
  contentId: z.string(),
  /** name of the reported user, only for user reports */
  contentName: z.string().optional(),
  reason: z.string(),
  comment: z.string(),
});
export type AdminReport = z.infer<typeof AdminReportSchema>;

export const GetReportsResponseSchema = responseWithData(
  z.array(AdminReportSchema),
);
export type GetReportsResponse = z.infer<typeof GetReportsResponseSchema>;

export const FindUserQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(100),
  })
  .strict();
export type FindUserQuery = z.infer<typeof FindUserQuerySchema>;

export const AdminUserSchema = z.object({
  uid: z.string(),
  name: z.string(),
  nickname: z.string().optional(),
  organization: z.string().optional(),
  email: z.string(),
  addedAt: z.number().int().nonnegative(),
  banned: z.boolean(),
  completedTests: z.number().int().nonnegative().optional(),
  timeTyping: z.number().nonnegative().optional(),
  streakHourOffset: z.number().optional(),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const FindUserResponseSchema = responseWithData(
  AdminUserSchema.nullable(),
);
export type FindUserResponse = z.infer<typeof FindUserResponseSchema>;

const c = initContract();
export const adminContract = c.router(
  {
    test: {
      summary: "test permission",
      description: "Check for admin permission for the current user",
      method: "GET",
      path: "",
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    findUser: {
      summary: "find user",
      description:
        "Find a user by uid, monkeytype name or ProgCompJOliva nickname.",
      method: "GET",
      path: "/user",
      query: FindUserQuerySchema,
      responses: {
        200: FindUserResponseSchema,
      },
    },
    toggleBan: {
      summary: "toggle user ban",
      description: "Ban an unbanned user or unban a banned user.",
      method: "POST",
      path: "/toggleBan",
      body: ToggleBanRequestSchema,
      responses: {
        200: ToggleBanResponseSchema,
      },
    },
    clearStreakHourOffset: {
      summary: "clear streak hour offset",
      description: "Clear the streak hour offset for a user",
      method: "POST",
      path: "/clearStreakHourOffset",
      body: ClearStreakHourOffsetRequestSchema,
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    deleteUser: {
      summary: "delete user",
      description:
        "Delete the account of the given user, including all their data.",
      method: "POST",
      path: "/deleteUser",
      body: DeleteUserRequestSchema,
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    getReports: {
      summary: "get reports",
      description: "Get all open quote and user reports, newest first",
      method: "GET",
      path: "/report",
      responses: {
        200: GetReportsResponseSchema,
      },
    },
    acceptReports: {
      summary: "accept reports",
      description: "Accept one or many reports",
      method: "POST",
      path: "/report/accept",
      body: AcceptReportsRequestSchema,
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    rejectReports: {
      summary: "reject reports",
      description: "Reject one or many reports",
      method: "POST",
      path: "/report/reject",
      body: RejectReportsRequestSchema,
      responses: {
        200: MonkeyResponseSchema,
      },
    },
    sendForgotPasswordEmail: {
      summary: "send forgot password email",
      description: "Send a forgot password email to the given user email",
      method: "POST",
      path: "/sendForgotPasswordEmail",
      body: SendForgotPasswordEmailRequestSchema,
      responses: {
        200: MonkeyResponseSchema,
      },
    },
  },
  {
    pathPrefix: "/admin",
    strictStatusCodes: true,
    metadata: meta({
      openApiTags: "admin",
      authenticationOptions: { noCache: true },
      rateLimit: "adminLimit",
      requirePermission: "admin",
      requireConfiguration: {
        path: "admin.endpointsEnabled",
        invalidMessage: "Admin endpoints are currently disabled.",
      },
    }),

    commonResponses: CommonResponses,
  },
);
