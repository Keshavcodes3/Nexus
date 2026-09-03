import { Server, ServerStatus } from "../schema/server.schema.js";
import { UserModel, UserRepository } from "../../Users/index.js";
import { createServerDTO, toServerResponseDTO, type UpdateServerDTO } from "../DTO/server.dto.js";
import { ApiError } from "../../../shared/HTTP/api-error.js";
import { validate } from "../utils/validateData.js";
import { generateSlug } from "../utils/generateSlug.js";
import mongoose, { Types } from "mongoose";
import { serverClass } from "../Repositary/server.repo.js";
import { Member } from "../../Channels/Schema/member.schema.js";
import { IdempotencyRepository } from "../../../shared/Idempotency/idempotency.repo.js";
import { OutboxRepository } from "../../../shared/Outbox/outbox.repo.js";
import { OutboxEventStatus, OutboxEventType } from "../../../shared/Outbox/outbox.schema.js";


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
        if (!idempotencyKey)
            throw new ApiError({ code: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency key required", statusCode: 400 })
        const userId = new Types.ObjectId(ownerId)
        validate({
            name: name,
            description: description || "",
            ownerID: userId
        })
        const session = await mongoose.startSession()
        try {
            let result: ReturnType<typeof toServerResponseDTO> | null = null
            await session.withTransaction(async () => {
                const owner = await this.userDB.findById(userId).session(session).exec()
                if (!owner) throw new ApiError({
                    code: "USER_NOT_FOUND",
                    message: "Owner not found",
                    statusCode: 404
                })

                // Idempotency check - must use same operation name for find & create
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


                const idempotencyRecord = await this.idempotencyRepo.create(
                    {
                        userId,
                        key: idempotencyKey,
                        operation: "CREATE_SERVER",
                        status: "PROCESSING",
                        lockedAt: new Date(),
                    },
                    session
                )
                if (!idempotencyRecord) throw new ApiError({ code: "IDEMPOTENCY_FAILED", message: "Failed to create idempotency record", statusCode: 500 })

                const slug = generateSlug(name)
                const [server] = await this.serverDB.create([
                    {
                        name: name,
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

                    status: OutboxEventStatus.PENDING,

                    attempts: 0,

                    availableAt: new Date(),
                }, session)


                const responseBody = toServerResponseDTO(server as never)
                const response = { statusCode: 201, body: responseBody }

                await this.idempotencyRepo.complete(idempotencyRecord._id, response, session)

                result = responseBody
            })
            return result
        } catch (err) {
            if (err instanceof ApiError) throw err
            throw new ApiError({ code: "SERVER_CREATE_FAILED", message: err instanceof Error ? err.message : "Failed to create server", statusCode: 500 })
        } finally {
            await session.endSession()
        }
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

    updateServer = async (
        serverId: string | Types.ObjectId,
        data: UpdateServerDTO & { title?: string }
    ) => {
        if (!serverId || !Types.ObjectId.isValid(String(serverId))) {
            throw new ApiError({ code: "INVALID_SERVER_ID", message: "Invalid server id", statusCode: 400 })
        }

        const payload: UpdateServerDTO = {}
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
        if (existing.status === ServerStatus.DELETED) throw new ApiError({ code: "SERVER_DELETED", message: "Cannot update deleted server", statusCode: 410 })
        if (existing.status === ServerStatus.SUSPENDED) throw new ApiError({ code: "SERVER_ARCHIVED", message: "Cannot update archived server, restore first", statusCode: 403 })

        const updated = await this.serverRepo.updateDetails(serverId, payload)
        if (!updated) throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        return toServerResponseDTO(updated as never)
    }

    deleteServer = async (serverId: string | Types.ObjectId) => {
        if (!serverId || !Types.ObjectId.isValid(String(serverId))) {
            throw new ApiError({ code: "INVALID_SERVER_ID", message: "Invalid server id", statusCode: 400 })
        }
        const existing = await this.serverRepo.findById(serverId)
        if (!existing) throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        if (existing.status === ServerStatus.DELETED) {
            throw new ApiError({ code: "SERVER_ALREADY_DELETED", message: "Server already deleted", statusCode: 409 })
        }
        const deleted = await this.serverRepo.softDelete(serverId)
        if (!deleted) throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        return toServerResponseDTO(deleted as never)
    }

    archiveServer = async (serverId: string | Types.ObjectId) => {
        if (!serverId || !Types.ObjectId.isValid(String(serverId))) {
            throw new ApiError({ code: "INVALID_SERVER_ID", message: "Invalid server id", statusCode: 400 })
        }
        const existing = await this.serverRepo.findById(serverId)
        if (!existing) throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        if (existing.status === ServerStatus.DELETED) throw new ApiError({ code: "SERVER_DELETED", message: "Cannot archive deleted server", statusCode: 410 })
        if (existing.status === ServerStatus.SUSPENDED) throw new ApiError({ code: "SERVER_ALREADY_ARCHIVED", message: "Server already archived", statusCode: 409 })

        const archived = await this.serverRepo.updateDetails(serverId, { status: ServerStatus.SUSPENDED })
        if (!archived) throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        return toServerResponseDTO(archived as never)
    }

    restoreServer = async (serverId: string | Types.ObjectId) => {
        if (!serverId || !Types.ObjectId.isValid(String(serverId))) {
            throw new ApiError({ code: "INVALID_SERVER_ID", message: "Invalid server id", statusCode: 400 })
        }
        const existing = await this.serverRepo.findById(serverId)
        if (!existing) throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        if (existing.status === ServerStatus.ACTIVE) {
            throw new ApiError({ code: "SERVER_ALREADY_ACTIVE", message: "Server is already active", statusCode: 409 })
        }
        // restore from DELETED or SUSPENDED -> ACTIVE, clear deletedAt and isDeleted flag
        const restored = await this.serverRepo.updateDetails(serverId, {
            status: ServerStatus.ACTIVE,
            deletedAt: null,
            settings: { isDeleted: false },
        })
        if (!restored) throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 })
        return toServerResponseDTO(restored as never)
    }
}

export { serverServiceClass }
export const serverService = new serverServiceClass()
