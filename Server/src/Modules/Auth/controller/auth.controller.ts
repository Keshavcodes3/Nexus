import type { Request, Response, NextFunction } from "express";
import { authService } from "../service/auth.service.js";
import { registerSchema, loginSchema } from "../schema/auth.validation.js";
import { apiSuccess } from "../../../shared/HTTP/api-response.js";
import { ApiError } from "../../../shared/HTTP/api-error.js";

const isProd = process.env.NODE_ENV === "production";

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: 15 * 60 * 1000, // 15m
        path: "/",
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
        path: "/",
    });
}

function clearAuthCookies(res: Response): void {
    res.clearCookie("accessToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/" });
}

function getMeta(req: Request): { ip?: string | undefined; userAgent?: string | undefined } {
    const ip: string | undefined = req.ip ?? undefined;
    const uaHeader = req.headers["user-agent"];
    const userAgent: string | undefined = Array.isArray(uaHeader) ? uaHeader[0] : uaHeader;
    return { ip, userAgent };
}

export class AuthController {
    async register(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const parsed = registerSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ApiError({
                    code: "VALIDATION_ERROR",
                    message: "Invalid registration data",
                    statusCode: 400,
                    details: parsed.error.flatten(),
                });
            }

            const result = await authService.register(parsed.data, getMeta(req));
            setAuthCookies(res, result.accessToken, result.refreshToken);

            res.status(201).json(
                apiSuccess(
                    {
                        user: result.user,
                        accessToken: result.accessToken,
                        refreshToken: result.refreshToken,
                    },
                    "Registered successfully",
                ),
            );
        } catch (err) {
            next(err);
        }
    }

    async login(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const parsed = loginSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ApiError({
                    code: "VALIDATION_ERROR",
                    message: "Invalid login data",
                    statusCode: 400,
                    details: parsed.error.flatten(),
                });
            }

            const result = await authService.login(parsed.data, getMeta(req));
            setAuthCookies(res, result.accessToken, result.refreshToken);

            res.json(
                apiSuccess(
                    {
                        user: result.user,
                        accessToken: result.accessToken,
                        refreshToken: result.refreshToken,
                    },
                    "Logged in successfully",
                ),
            );
        } catch (err) {
            next(err);
        }
    }

    async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const tokenFromBody = (req.body as { refreshToken?: string })?.refreshToken;
            const tokenFromCookie = (req.cookies as Record<string, string> | undefined)?.["refreshToken"];
            const refreshToken = tokenFromBody ?? tokenFromCookie;

            if (!refreshToken || typeof refreshToken !== "string") {
                throw new ApiError({
                    code: "UNAUTHORIZED",
                    message: "Refresh token required",
                    statusCode: 401,
                });
            }

            const result = await authService.refresh(refreshToken, getMeta(req));
            setAuthCookies(res, result.accessToken, result.refreshToken);

            res.json(
                apiSuccess(
                    {
                        user: result.user,
                        accessToken: result.accessToken,
                        refreshToken: result.refreshToken,
                    },
                    "Token refreshed",
                ),
            );
        } catch (err) {
            next(err);
        }
    }

    async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const tokenFromBody = (req.body as { refreshToken?: string })?.refreshToken;
            const tokenFromCookie = (req.cookies as Record<string, string> | undefined)?.["refreshToken"];
            const refreshToken = tokenFromBody ?? tokenFromCookie;

            if (refreshToken) {
                await authService.logout(refreshToken);
            }

            clearAuthCookies(res);
            res.json(apiSuccess(null, "Logged out successfully"));
        } catch (err) {
            next(err);
        }
    }

    async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new ApiError({
                    code: "UNAUTHORIZED",
                    message: "Not authenticated",
                    statusCode: 401,
                });
            }
            await authService.logoutAll(userId);
            clearAuthCookies(res);
            res.json(apiSuccess(null, "Logged out from all devices"));
        } catch (err) {
            next(err);
        }
    }

    async me(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new ApiError({
                    code: "UNAUTHORIZED",
                    message: "Not authenticated",
                    statusCode: 401,
                });
            }
            // Reuse user service via authService? fetch fresh
            // We can just return req.user + fetch full profile
            const { userRepository } = await import("../../Users/repository/user.repository.js");
            const user = await userRepository.findById(userId);
            if (!user) {
                throw new ApiError({
                    code: "USER_NOT_FOUND",
                    message: "User not found",
                    statusCode: 404,
                });
            }
            res.json(
                apiSuccess(
                    {
                        id: user._id.toString(),
                        username: user.username,
                        email: user.email,
                        displayName: user.displayName,
                        avatarUrl: user.avatarUrl ?? null,
                        bannerUrl: user.bannerUrl ?? null,
                        bio: user.bio ?? "",
                        status: user.status,
                        isVerified: user.isVerified,
                        createdAt: user.createdAt,
                    },
                    "Current user",
                ),
            );
        } catch (err) {
            next(err);
        }
    }
}

export const authController = new AuthController();
