import { Server } from "../schema/server.schema.js";
import { UserModel, UserRepository } from "../../Users/index.js";
import { createServerDTO, toServerResponseDTO } from "../DTO/server.dto.js";
import { ApiError } from "../../../shared/HTTP/api-error.js";
import { validate } from "../utils/validateData.js";
import { generateSlug } from "../utils/generateSlug.js";
import mongoose, { Types } from "mongoose";
import { serverClass } from "../Repositary/server.repo.js";
import { Member } from "../../Channels/Schema/member.schema.js";
import { IdempotencyRepository } from "../../../shared/Idempotency/idempotency.repo.js";


class serverServiceClass {
    private userDB = UserModel;
    private serverDB = Server;
    private memberDB = Member;
    constructor(
        private readonly userRepo = new UserRepository(),
        private readonly serverRepo = new serverClass(),
        private readonly idempotencyRepo = new IdempotencyRepository()
    ) { }

    createServer = async (data: createServerDTO) => {
        const { name, description, icon, ownerId, idempotencyKey } = data
        if (!idempotencyKey) throw new ApiError({ code: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency key required", statusCode: 400 })
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
}

export { serverServiceClass }
export const serverService = new serverServiceClass()
