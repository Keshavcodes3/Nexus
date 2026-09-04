import { Server, ServerStatus, normalizeServerName } from "../schema/server.schema.js";
import { UserModel, UserRepository } from "../../Users/index.js";
import { createServerDTO, toServerResponseDTO, type UpdateServerDTO } from "../DTO/server.dto.js";
import { ApiError } from "../../../shared/HTTP/api-error.js";
import { validate } from "../utils/validateData.js";
import { generateSlug } from "../utils/generateSlug.js";

function isDuplicateKeyError(err: unknown): boolean {
    return (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: unknown }).code === 11000
    );
}
import mongoose, { Types } from "mongoose";
import { serverClass } from "../Repositary/server.repo.js";
import { Channel } from "../../Channels/Schema/channel.schema.js";
import { IdempotencyRepository } from "../../../shared/Idempotency/idempotency.repo.js";
import { OutboxRepository } from "../../../shared/Outbox/outbox.repo.js";
import { OutboxEventStatus, OutboxEventType } from "../../../shared/Outbox/outbox.schema.js";
import { Member } from "../../Member/Schema/member.schema.js";

class serverServiceClass {
    private userDB = UserModel;
    private serverDB = Server;
    private memberDB = Member;
    constructor(
        private readonly userRepo = new UserRepository(),
        private readonly serverRepo = new serverClass(),
        private readonly idempotencyRepo = new IdempotencyRepository(),
        private readonly outboxRepo = new OutboxRepository()
    ) { }

    createServer = async (data: createServerDTO) => {
        const { name, description, icon, ownerId, idempotencyKey } = data
        if (!idempotencyKey) {
            throw new ApiError(
                {
                    code: "IDEMPOTENCY_KEY_REQUIRED",
                    message: "Idempotency key required",
                    statusCode: 400
                }
            )
        }

        const trimmedName = name.trim();
        if (!trimmedName) throw new ApiError({ code: "INVALID_NAME", message: "Server name cannot be empty", statusCode: 400 });
        const normalized = normalizeServerName(trimmedName);
        const userId = new Types.ObjectId(ownerId)
        validate({ name: trimmedName, description: description as string, ownerID: userId })
        const session = await mongoose.startSession()
        let result: ReturnType<typeof toServerResponseDTO> | undefined;
        try {
            await session.withTransaction(async () => {
                const owner = await this.userDB
                    .findById(userId.toString())
                    .session(session).exec()
                if (!owner) throw new ApiError({
                    code: "USER_NOT_FOUND",
                    message: "Owner not found",
                    statusCode: 404
                })
                //check for idempotency
                const existing = await this.idempotencyRepo.find(userId, "CREATE_SERVER", idempotencyKey, session)
                if (existing) {
                    if (existing.status === "COMPLETED") {
                        result = existing.response?.body as ReturnType<typeof toServerResponseDTO>
                        return
                    }
                    if (existing.status === "PROCESSING") {
                        throw new ApiError({
                            code: "REQUEST_IN_PROGRESS",
                            message: "This request is already being processed",
                            statusCode: 409
                        })
                    }
                }

                // Best-practice: app-level uniqueness check for {ownerId, nameNormalized} (case/whitespace-insensitive)
                const duplicate = await this.serverDB.findOne({
                    ownerId: userId,
                    nameNormalized: normalized,
                    status: { $ne: ServerStatus.DELETED },
                } as never).session(session).exec();
                if (duplicate) {
                    throw new ApiError({
                        code: "SERVER_NAME_TAKEN",
                        message: "You already have a server with this name",
                        statusCode: 409,
                    });
                }

                const idempotencyRecord = await this.idempotencyRepo.create(
                    {
                        userId,
                        key: idempotencyKey,
                        operation: "CREATE_SERVER",
                        status: "PROCESSING",
                        lockedAt: new Date(),
                    }, session)

                if (!idempotencyRecord) throw new ApiError({ code: "IDEMPOTENCY_FAILED", message: "Failed to create idempotency record", statusCode: 500 })
                const slug = generateSlug(trimmedName)

                const [server] = await this.serverDB.create([
                    {
                        name: trimmedName,
                        nameNormalized: normalized,
                        ...(description !== undefined ? { description } : {}),
                        ...(icon !== undefined ? { icon } : {}),
                        ownerId: userId,
                        slug
                    } as never],
                    {
                        session
                    }
                )
                if (!server) throw new ApiError({ code: "SERVER_CREATE_FAILED", message: "Failed to create server", statusCode: 500 })

                await this.memberDB.create([{
                    serverId: server._id,
                    userId,
                    role: "OWNER" as const,
                }], { session })
                const responseBody = toServerResponseDTO(server as never)
                const response = { statusCode: 201, body: responseBody }
                await this.outboxRepo.create({
                    eventId: crypto.randomUUID(),
                    type: OutboxEventType.SERVER_CREATED,
                    aggregateType: "SERVER",
                    aggregateId: server._id,
                    payload: {
                        serverId: server._id.toString(),
                        ownerId: userId.toString(),
                        name: server.name,
                    },
                    attempts: 0,
                    availableAt: new Date(),
                    status: OutboxEventStatus.PENDING,
                }, session)
                await this.idempotencyRepo.complete(idempotencyRecord._id, response, session)

                result = responseBody
                return result
            })
        } catch (err) {
            if (err instanceof ApiError) throw err
            if (isDuplicateKeyError(err)) {
                const dupErr = err as { keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown> };
                const isNameDup = dupErr.keyPattern?.["nameNormalized"] || dupErr.keyValue?.["nameNormalized"] || String((err as Error).message).includes("nameNormalized");
                if (isNameDup) {
                    throw new ApiError({ code: "SERVER_NAME_TAKEN", message: "You already have a server with this name", statusCode: 409 });
                }
                // slug collision (global unique) - should be rare due to hash, map to 409 as well
                throw new ApiError({ code: "SERVER_CREATE_FAILED", message: "Server slug collision, please retry with a different name", statusCode: 409 });
            }
            throw new ApiError({ code: "SERVER_CREATE_FAILED", message: err instanceof Error ? err.message : "Failed to create server", statusCode: 500 })

        } finally {
            await session.endSession()
        }
        return result
    }

    getServerById = async (serverId: string | Types.ObjectId) => {
        if (!serverId || !Types.ObjectId.isValid(String(serverId))) {
            throw new ApiError({ code: "INVALID_SERVER_ID", message: "Invalid server id", statusCode: 400 })
        }
        const server = await this.serverRepo.findById(serverId)
        if (!server) {
            throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        }
        if (server.status === ServerStatus.DELETED) {
            throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        }
        return toServerResponseDTO(server as never)
    }

    getServerBySlug = async (slug: string) => {
        if (!slug || !slug.trim()) {
            throw new ApiError({ code: "INVALID_SLUG", message: "Slug is required", statusCode: 400 })
        }
        const server = await this.serverRepo.findBySlug(slug)
        if (!server) {
            throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        }
        if (server.status === ServerStatus.DELETED) {
            throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        }
        return toServerResponseDTO(server as never)
    }

    private assertOwner = (server: { ownerId: Types.ObjectId | string }, requesterId: string | Types.ObjectId) => {
        if (server.ownerId.toString() !== String(requesterId)) {
            throw new ApiError({ code: "FORBIDDEN", message: "Only owner can perform this action", statusCode: 403 })
        }
    }

    updateServer = async (
        serverId: string | Types.ObjectId,
        requesterId: string | Types.ObjectId,
        data: UpdateServerDTO & { title?: string }
    ) => {
        if (!serverId || !Types.ObjectId.isValid(String(serverId))) {
            throw new ApiError({ code: "INVALID_SERVER_ID", message: "Invalid server id", statusCode: 400 })
        }

        const payload: UpdateServerDTO & { nameNormalized?: string | undefined } = {}
        if (data.title !== undefined) payload.name = data.title
        if (data.name !== undefined) payload.name = data.name
        if (data.description !== undefined) payload.description = data.description
        if (data.icon !== undefined) payload.icon = data.icon
        if (data.settings !== undefined) payload.settings = data.settings
        if (data.status !== undefined) payload.status = data.status

        if (payload.name !== undefined) {
            const trimmed = payload.name.trim()
            if (!trimmed) throw new ApiError({ code: "INVALID_NAME", message: "Server name cannot be empty", statusCode: 400 })
            if (trimmed.length > 100) throw new ApiError({ code: "INVALID_NAME", message: "Server name too long", statusCode: 400 })
            payload.name = trimmed
            payload.nameNormalized = normalizeServerName(trimmed)
            // keep slug in sync with name if slug not explicitly provided
            if (data.slug === undefined) {
                payload.slug = generateSlug(trimmed)
            }
        }
        if (data.slug !== undefined) payload.slug = data.slug.toLowerCase().trim()

        if (Object.keys(payload).length === 0) {
            throw new ApiError({ code: "NO_UPDATE_DATA", message: "No update data provided", statusCode: 400 })
        }

        const existing = await this.serverRepo.findById(serverId)
        if (!existing) throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        this.assertOwner(existing as never, requesterId)
        if (existing.status === ServerStatus.DELETED) throw new ApiError({ code: "SERVER_DELETED", message: "Cannot update deleted server", statusCode: 410 })
        if (existing.status === ServerStatus.SUSPENDED) throw new ApiError({ code: "SERVER_ARCHIVED", message: "Cannot update archived server, restore first", statusCode: 403 })

        // Enforce {ownerId, nameNormalized} uniqueness on rename
        if (payload.nameNormalized !== undefined) {
            const dup = await this.serverDB.findOne({
                ownerId: existing.ownerId,
                nameNormalized: payload.nameNormalized,
                _id: { $ne: existing._id },
                status: { $ne: ServerStatus.DELETED },
            } as never).exec();
            if (dup) {
                throw new ApiError({ code: "SERVER_NAME_TAKEN", message: "You already have a server with this name", statusCode: 409 });
            }
        }

        try {
            const updated = await this.serverRepo.updateDetails(serverId, payload as unknown as UpdateServerDTO)
            if (!updated) throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
            return toServerResponseDTO(updated as never)
        } catch (err) {
            if (err instanceof ApiError) throw err;
            if (isDuplicateKeyError(err)) {
                throw new ApiError({ code: "SERVER_NAME_TAKEN", message: "You already have a server with this name", statusCode: 409 });
            }
            throw err;
        }
    }

    deleteServer = async (serverId: string | Types.ObjectId, requesterId: string | Types.ObjectId) => {
        if (!serverId || !Types.ObjectId.isValid(String(serverId))) {
            throw new ApiError({ code: "INVALID_SERVER_ID", message: "Invalid server id", statusCode: 400 })
        }
        const existing = await this.serverRepo.findById(serverId)
        if (!existing) throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        this.assertOwner(existing as never, requesterId)
        if (existing.status === ServerStatus.DELETED) {
            throw new ApiError({ code: "SERVER_ALREADY_DELETED", message: "Server already deleted", statusCode: 409 })
        }
        const deleted = await this.serverRepo.softDelete(serverId)
        if (!deleted) throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        return toServerResponseDTO(deleted as never)
    }

    archiveServer = async (serverId: string | Types.ObjectId, requesterId: string | Types.ObjectId) => {
        if (!serverId || !Types.ObjectId.isValid(String(serverId))) {
            throw new ApiError({ code: "INVALID_SERVER_ID", message: "Invalid server id", statusCode: 400 })
        }
        const existing = await this.serverRepo.findById(serverId)
        if (!existing) throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        this.assertOwner(existing as never, requesterId)
        if (existing.status === ServerStatus.DELETED) throw new ApiError({ code: "SERVER_DELETED", message: "Cannot archive deleted server", statusCode: 410 })
        if (existing.status === ServerStatus.SUSPENDED) throw new ApiError({ code: "SERVER_ALREADY_ARCHIVED", message: "Server already archived", statusCode: 409 })

        const archived = await this.serverRepo.updateDetails(serverId, { status: ServerStatus.SUSPENDED })
        if (!archived) throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        return toServerResponseDTO(archived as never)
    }

    restoreServer = async (serverId: string | Types.ObjectId, requesterId: string | Types.ObjectId) => {
        if (!serverId || !Types.ObjectId.isValid(String(serverId))) {
            throw new ApiError({ code: "INVALID_SERVER_ID", message: "Invalid server id", statusCode: 400 })
        }
        const existing = await this.serverRepo.findById(serverId)
        if (!existing) throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        this.assertOwner(existing as never, requesterId)
        if (existing.status === ServerStatus.ACTIVE) {
            throw new ApiError({ code: "SERVER_ALREADY_ACTIVE", message: "Server is already active", statusCode: 409 })
        }
        // Enforce name uniqueness on restore - partial index excludes DELETED, so check conflict
        const normalized = (existing as unknown as { nameNormalized?: string }).nameNormalized ?? normalizeServerName(existing.name);
        const dupOnRestore = await this.serverDB.findOne({
            ownerId: existing.ownerId,
            nameNormalized: normalized,
            _id: { $ne: existing._id },
            status: { $ne: ServerStatus.DELETED },
        } as never).exec();
        if (dupOnRestore) {
            throw new ApiError({ code: "SERVER_NAME_TAKEN", message: "Cannot restore: you already have an active server with this name. Please rename first.", statusCode: 409 });
        }
        // restore from DELETED or SUSPENDED -> ACTIVE, clear deletedAt and isDeleted flag
        try {
            const restored = await this.serverRepo.updateDetails(serverId, {
                status: ServerStatus.ACTIVE,
                deletedAt: null,
                settings: { isDeleted: false },
            } as never)
            if (!restored) throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
            return toServerResponseDTO(restored as never)
        } catch (err) {
            if (err instanceof ApiError) throw err;
            if (isDuplicateKeyError(err)) {
                throw new ApiError({ code: "SERVER_NAME_TAKEN", message: "Cannot restore: name conflict with existing server", statusCode: 409 });
            }
            throw err;
        }
    }
}

export { serverServiceClass }
export const serverService = new serverServiceClass()
