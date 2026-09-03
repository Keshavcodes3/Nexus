import { Request, Response, NextFunction } from "express";
import { ApiError } from "../shared/HTTP/api-error.js";

export function errorMiddleware(
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
) {
    if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                details: error.details,
            },
        });
    }

    // Best-practice fallback: handle race-condition duplicate key errors not caught in service layer
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: unknown }).code === 11000
    ) {
        const dupErr = error as { keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown>; message?: string };
        const msg = dupErr.message ?? "";
        const isNameDup =
            dupErr.keyPattern?.["nameNormalized"] ||
            dupErr.keyValue?.["nameNormalized"] ||
            msg.includes("nameNormalized") ||
            msg.includes("idx_servers_owner_name_unique");
        if (isNameDup) {
            return res.status(409).json({
                success: false,
                error: {
                    code: "SERVER_NAME_TAKEN",
                    message: "You already have a server with this name",
                },
            });
        }
        if (msg.includes("idx_servers_slug_unique") || msg.includes('"slug"')) {
            return res.status(409).json({
                success: false,
                error: {
                    code: "SERVER_SLUG_TAKEN",
                    message: "Server slug already taken, please try a different name",
                },
            });
        }
    }

    console.error(error);

    return res.status(500).json({
        success: false,
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred",
        },
    });
}