import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { userService } from "../service/user.service.js";
import { apiSuccess } from "../../../shared/HTTP/api-response.js";
import { ApiError } from "../../../shared/HTTP/api-error.js";

const updateProfileSchema = z.object({
    displayName: z.string().min(1).max(32).trim().optional(),
    bio: z.string().max(190).optional(),
    avatarUrl: z.string().url().nullable().optional(),
    bannerUrl: z.string().url().nullable().optional(),
    status: z.enum(["online", "idle", "dnd", "offline", "invisible"]).optional(),
    customStatus: z.string().max(128).nullable().optional(),
});

const searchQuerySchema = z.object({
    q: z.string().min(1).max(50),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});

export class UserController {
    async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new ApiError({
                    code: "UNAUTHORIZED",
                    message: "Not authenticated",
                    statusCode: 401,
                });
            }
            const user = await userService.getMe(userId);
            res.json(apiSuccess(user, "Profile fetched"));
        } catch (err) {
            next(err);
        }
    }

    async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new ApiError({
                    code: "UNAUTHORIZED",
                    message: "Not authenticated",
                    statusCode: 401,
                });
            }
            const parsed = updateProfileSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ApiError({
                    code: "VALIDATION_ERROR",
                    message: "Invalid profile data",
                    statusCode: 400,
                    details: parsed.error.flatten(),
                });
            }
            // Normalize nulls and build partial input respecting exactOptionalPropertyTypes
            const input: Record<string, unknown> = {};
            if (parsed.data.displayName !== undefined) input["displayName"] = parsed.data.displayName;
            if (parsed.data.bio !== undefined) input["bio"] = parsed.data.bio;
            if (parsed.data.avatarUrl !== undefined) input["avatarUrl"] = parsed.data.avatarUrl === null ? "" : parsed.data.avatarUrl;
            if (parsed.data.bannerUrl !== undefined) input["bannerUrl"] = parsed.data.bannerUrl === null ? "" : parsed.data.bannerUrl;
            if (parsed.data.status !== undefined) input["status"] = parsed.data.status;
            if (parsed.data.customStatus !== undefined) input["customStatus"] = parsed.data.customStatus === null ? "" : parsed.data.customStatus;

            const updated = await userService.updateProfile(
                userId,
                input as Parameters<typeof userService.updateProfile>[1],
            );
            res.json(apiSuccess(updated, "Profile updated"));
        } catch (err) {
            next(err);
        }
    }

    async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params as { id: string };
            if (!id) {
                throw new ApiError({
                    code: "VALIDATION_ERROR",
                    message: "User id required",
                    statusCode: 400,
                });
            }
            const user = await userService.getPublicProfile(id);
            res.json(apiSuccess(user, "User fetched"));
        } catch (err) {
            next(err);
        }
    }

    async search(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const parsed = searchQuerySchema.safeParse(req.query);
            if (!parsed.success) {
                throw new ApiError({
                    code: "VALIDATION_ERROR",
                    message: "Invalid search query",
                    statusCode: 400,
                    details: parsed.error.flatten(),
                });
            }
            const users = await userService.searchUsers(parsed.data.q, parsed.data.limit);
            res.json(apiSuccess(users, "Search results"));
        } catch (err) {
            next(err);
        }
    }
}

export const userController = new UserController();
