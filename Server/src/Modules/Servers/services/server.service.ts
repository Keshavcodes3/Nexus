import { Server } from "../schema/server.schema.js";
import { UserModel } from "../../Users/index.js";
import type { CreateServerDTO } from "../DTO/server.dto.js";
import { ApiError } from "../../../shared/HTTP/api-error.js";
import { validate } from "../utils/validateData.js";
import { generateSlug } from "../utils/generateSlug.js";
import mongoose, { Types } from "mongoose";
import { ServerRepository } from "../Repositary/server.repo.js";
import { Member } from "../../Channels/Schema/member.schema.js";

export class ServerService {
    private userDB = UserModel;
    private serverDB = Server;
    private memberDB = Member;
    constructor(
        private readonly serverRepo = new ServerRepository(),
    ) { }

    createServer = async (data: CreateServerDTO) => {
        const { name, description, icon, ownerId } = data
        const userId = ownerId instanceof Types.ObjectId ? ownerId : new Types.ObjectId(ownerId as string)

        validate({
            name: name,
            description: description ?? "",
            ownerID: userId
        })

        const session = await mongoose.startSession()
        try {
            let createdServer: Awaited<ReturnType<typeof Server.create>>[number] | undefined

            await session.withTransaction(async () => {
                const owner = await this.userDB.findById(userId).session(session).exec()
                if (!owner) throw new ApiError({
                    code: "USER_NOT_FOUND",
                    message: "Owner not found",
                    statusCode: 404
                })
                const slug = generateSlug(name)
                const serverPayload: Record<string, unknown> = {
                    name,
                    ownerId: userId,
                    slug,
                }
                if (description !== undefined) serverPayload["description"] = description
                if (icon !== undefined) serverPayload["icon"] = icon

                const docs = await this.serverDB.create([serverPayload], { session })
                const server = docs[0]
                if (!server) throw new ApiError({
                    code: "SERVER_CREATE_FAILED",
                    message: "Failed to create server",
                    statusCode: 500
                })

                // Owner automatically becomes a member with OWNER role
                await this.memberDB.create([{
                    serverId: server._id,
                    userId,
                    role: "OWNER" as const,
                }], { session })

                createdServer = server
            })

            return createdServer

        } catch (err) {
            if (err instanceof ApiError) throw err
            throw new ApiError({
                code: "SERVER_CREATE_FAILED",
                message: err instanceof Error ? err.message : "Failed to create server",
                statusCode: 500
            })
        } finally {
            await session.endSession()
        }
    }
}


export const serverServiceClass = ServerService
export const serverService = new ServerService()
export default ServerService
