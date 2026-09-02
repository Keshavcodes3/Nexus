import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../shared/HTTP/api-error.js";

export interface AuthUserPayload {
    id: string;
    username: string;
    email: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUserPayload;
        }
    }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
    try {
        const header = req.headers.authorization;
        const cookieToken = (req.cookies as Record<string, string> | undefined)?.["accessToken"];
        let token: string | undefined;

        if (header?.startsWith("Bearer ")) {
            token = header.split(" ")[1];
        } else if (cookieToken) {
            token = cookieToken;
        }

        if (!token) {
            throw new ApiError({
                code: "UNAUTHORIZED",
                message: "Authentication required",
                statusCode: 401,
            });
        }

        const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
            userId: string;
            username: string;
            email: string;
        };

        req.user = {
            id: payload.userId,
            username: payload.username,
            email: payload.email,
        };

        next();
    } catch (error) {
        if (error instanceof ApiError) return next(error);
        next(
            new ApiError({
                code: "UNAUTHORIZED",
                message: "Invalid or expired token",
                statusCode: 401,
            }),
        );
    }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.["accessToken"];
    let token: string | undefined;
    if (header?.startsWith("Bearer ")) token = header.split(" ")[1];
    else if (cookieToken) token = cookieToken;

    if (!token) return next();

    try {
        const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
            userId: string;
            username: string;
            email: string;
        };
        req.user = {
            id: payload.userId,
            username: payload.username,
            email: payload.email,
        };
    } catch {
        // ignore invalid token for optional auth
    }
    next();
}
