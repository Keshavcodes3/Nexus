import type { Request, Response, NextFunction } from "express";
import { serverService } from "../services/server.service.js";
import { apiSuccess } from "../../../shared/HTTP/api-response.js";
import { ApiError } from "../../../shared/HTTP/api-error.js";
import { createServerSchema, updateServerSchema } from "../DTO/server.dto.js";

function getIdempotencyKey(req: Request): string {
    const headerKey = req.headers["idempotency-key"] ?? req.headers["x-idempotency-key"];
    const raw = Array.isArray(headerKey) ? headerKey[0] : headerKey;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    const bodyKey = (req.body as Record<string, unknown>)?.["idempotencyKey"];
    if (typeof bodyKey === "string" && bodyKey.trim()) return bodyKey.trim();
    return "";
}

export class ServerController {
    async createServer(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) throw new ApiError({ code: "UNAUTHORIZED", message: "Not authenticated", statusCode: 401 });

            const parsed = createServerSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ApiError({
                    code: "VALIDATION_ERROR",
                    message: "Invalid server data",
                    statusCode: 400,
                    details: parsed.error.flatten(),
                });
            }

            const idempotencyKey = getIdempotencyKey(req);
            if (!idempotencyKey) {
                throw new ApiError({
                    code: "IDEMPOTENCY_KEY_REQUIRED",
                    message: "Idempotency-Key header is required",
                    statusCode: 400,
                });
            }

            const payload: Record<string, unknown> = {
                name: parsed.data.name,
                ownerId: userId,
                idempotencyKey,
            };
            if (parsed.data.description !== undefined) payload["description"] = parsed.data.description;
            if (parsed.data.icon !== undefined) payload["icon"] = parsed.data.icon;
            if (parsed.data.settings !== undefined) payload["settings"] = parsed.data.settings;

            const server = await serverService.createServer(payload as never);
            res.status(201).json(apiSuccess(server, "Server created"));
        } catch (err) {
            next(err);
        }
    }

    async getServerById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params as { id: string };
            if (!id) throw new ApiError({ code: "VALIDATION_ERROR", message: "Server id required", statusCode: 400 });
            const server = await serverService.getServerById(id);
            res.json(apiSuccess(server, "Server fetched"));
        } catch (err) {
            next(err);
        }
    }

    async getServerBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { slug } = req.params as { slug: string };
            if (!slug) throw new ApiError({ code: "VALIDATION_ERROR", message: "Slug required", statusCode: 400 });
            const server = await serverService.getServerBySlug(slug);
            res.json(apiSuccess(server, "Server fetched"));
        } catch (err) {
            next(err);
        }
    }

    async updateServer(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) throw new ApiError({ code: "UNAUTHORIZED", message: "Not authenticated", statusCode: 401 });
            const { id } = req.params as { id: string };
            if (!id) throw new ApiError({ code: "VALIDATION_ERROR", message: "Server id required", statusCode: 400 });

            const parsed = updateServerSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ApiError({
                    code: "VALIDATION_ERROR",
                    message: "Invalid update data",
                    statusCode: 400,
                    details: parsed.error.flatten(),
                });
            }

            const input: Record<string, unknown> = {};
            if (parsed.data.name !== undefined) input["name"] = parsed.data.name;
            if (parsed.data.title !== undefined) input["title"] = parsed.data.title;
            if (parsed.data.description !== undefined) input["description"] = parsed.data.description;
            if (parsed.data.slug !== undefined) input["slug"] = parsed.data.slug;
            if (parsed.data.icon !== undefined) input["icon"] = parsed.data.icon;
            if (parsed.data.settings !== undefined) input["settings"] = parsed.data.settings;
            if (parsed.data.status !== undefined) input["status"] = parsed.data.status;

            const updated = await serverService.updateServer(id, userId, input as never);
            res.json(apiSuccess(updated, "Server updated"));
        } catch (err) {
            next(err);
        }
    }

    async deleteServer(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) throw new ApiError({ code: "UNAUTHORIZED", message: "Not authenticated", statusCode: 401 });
            const { id } = req.params as { id: string };
            if (!id) throw new ApiError({ code: "VALIDATION_ERROR", message: "Server id required", statusCode: 400 });
            const deleted = await serverService.deleteServer(id, userId);
            res.json(apiSuccess(deleted, "Server deleted"));
        } catch (err) {
            next(err);
        }
    }

    async archiveServer(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) throw new ApiError({ code: "UNAUTHORIZED", message: "Not authenticated", statusCode: 401 });
            const { id } = req.params as { id: string };
            if (!id) throw new ApiError({ code: "VALIDATION_ERROR", message: "Server id required", statusCode: 400 });
            const archived = await serverService.archiveServer(id, userId);
            res.json(apiSuccess(archived, "Server archived"));
        } catch (err) {
            next(err);
        }
    }

    async restoreServer(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) throw new ApiError({ code: "UNAUTHORIZED", message: "Not authenticated", statusCode: 401 });
            const { id } = req.params as { id: string };
            if (!id) throw new ApiError({ code: "VALIDATION_ERROR", message: "Server id required", statusCode: 400 });
            const restored = await serverService.restoreServer(id, userId);
            res.json(apiSuccess(restored, "Server restored"));
        } catch (err) {
            next(err);
        }
    }
}

export const serverController = new ServerController();
