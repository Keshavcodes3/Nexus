import { UserModel } from "../../Users/index.js";
import { Server, ServerStatus } from "../../Servers/schema/server.schema.js";
import { Channel, ChannelStatus, ChannelType, normalizedChannelName } from "../Schema/channel.schema.js";
import { UserRepository } from "../../Users/index.js";
import { ServerRepository } from "../../Servers/Repositary/server.repo.js";
import { CreateChannelDTO, toChannelResponseDTO } from "../DTO/channel.dto.js";
import { channelRepositaryClass } from "../Repositary/channel.reporitary.js";
import mongoose, { Types } from "mongoose";
import { ApiError } from "../../../shared/HTTP/api-error.js";
import { OutboxRepository } from "../../../shared/Outbox/outbox.repo.js";
import { OutboxEventStatus, OutboxEventType } from "../../../shared/Outbox/outbox.schema.js";
import { IdempotencyRepository } from "../../../shared/Idempotency/idempotency.repo.js";
import { generateSlug } from "../../Servers/utils/generateSlug.js";

function isDuplicateKeyError(err: unknown): boolean {
    return (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: unknown }).code === 11000
    );
}

export class channelServiceClass {
    private readonly userDB = UserModel;
    private readonly channelDB = Channel;
    private readonly serverDB = Server;

    constructor(
        private readonly userRepo = new UserRepository(),
        private readonly serverRepo = new ServerRepository(),
        private readonly channelRepo = new channelRepositaryClass(),
        private readonly outboxRepo = new OutboxRepository(),
        private readonly idempotencyRepo = new IdempotencyRepository(),
    ) {}

    create = async (data: CreateChannelDTO, idempotencyKey: string) => {
        if (!idempotencyKey?.trim()) {
            throw new ApiError({
                code: "IDEMPOTENCY_KEY_REQUIRED",
                message: "Idempotency key required",
                statusCode: 400,
            });
        }

        const { name, description, ownerId, serverId, type } = data;

        const trimmedName = name?.trim();
        if (!trimmedName) {
            throw new ApiError({ code: "INVALID_NAME", message: "Channel name cannot be empty", statusCode: 400 });
        }
        if (trimmedName.length > 100) {
            throw new ApiError({ code: "INVALID_NAME", message: "Channel name too long", statusCode: 400 });
        }
        const normalized = normalizedChannelName(trimmedName);

        if (!ownerId || !Types.ObjectId.isValid(String(ownerId))) {
            throw new ApiError({ code: "NO_OWNER_FOUND", message: "UNAUTHORIZED", statusCode: 401 });
        }
        if (!serverId || !Types.ObjectId.isValid(String(serverId))) {
            throw new ApiError({ code: "NO_SERVER_ID_PROVIDED", message: "Server ID required", statusCode: 400 });
        }

        const normalizedUserId = new Types.ObjectId(ownerId);
        const normalizedServerId = new Types.ObjectId(serverId);
        const slug = generateSlug(trimmedName);

        const session = await mongoose.startSession();
        let result: ReturnType<typeof toChannelResponseDTO> | undefined;

        try {
            await session.withTransaction(async () => {
                const owner = await this.userDB.findById(normalizedUserId).session(session).exec();
                if (!owner) {
                    throw new ApiError({ code: "USER_NOT_FOUND", message: "Owner not found", statusCode: 404 });
                }

                const serverDoc = await this.serverDB.findById(normalizedServerId).session(session).exec();
                if (!serverDoc) {
                    throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 });
                }
                if ((serverDoc as unknown as { status: ServerStatus }).status === ServerStatus.DELETED) {
                    throw new ApiError({ code: "SERVER_NOT_FOUND", message: "Server not found", statusCode: 404 });
                }

                if (serverDoc.ownerId.toString() !== normalizedUserId.toString()) {
                    throw new ApiError({ code: "FORBIDDEN", message: "Only server owner can create channel", statusCode: 403 });
                }

                const existing = await this.idempotencyRepo.find(normalizedUserId, "CREATE_CHANNEL", idempotencyKey, session);
                if (existing) {
                    if (existing.status === "COMPLETED") {
                        result = existing.response?.body as ReturnType<typeof toChannelResponseDTO>;
                        return;
                    }
                    if (existing.status === "PROCESSING") {
                         throw new ApiError({
                            code: "REQUEST_IN_PROGRESS",
                            message: "This request is already being processed",
                            statusCode: 409,
                       });
                    }
                }

                const duplicate = await this.channelDB
                    .findOne({
                        serverId: normalizedServerId,
                        nameNormalized: normalized,
                        status: { $ne: ChannelStatus.DELETED },
                    } as never)
                    .session(session)
                    .exec();
                if (duplicate) {
                    throw new ApiError({
                        code: "CHANNEL_ALREADY_EXIST",
                        message: "Channel with this name already exists in this server",
                        statusCode: 409,
                    });
                }

                const idempotencyRecord = await this.idempotencyRepo.create(
                    {
                        userId: normalizedUserId,
                        key: idempotencyKey,
                        operation: "CREATE_CHANNEL",
                        status: "PROCESSING",
                        lockedAt: new Date(),
                    },
                    session,
                );
                if (!idempotencyRecord) {
                    throw new ApiError({ code: "IDEMPOTENCY_FAILED", message: "Failed to create idempotency record", statusCode: 500 });
                }

                const [createdChannel] = await this.channelDB.create(
                    [
                        {
                            name: trimmedName,
                            nameNormalized: normalized,
                            slug,
                            ...(description !== undefined ? { description } : {}),
                            serverId: normalizedServerId,
                            ownerId: normalizedUserId,
                            type: type ?? ChannelType.TEXT,
                            status: ChannelStatus.ACTIVE,
                        } as never,
                    ],
                    { session },
                );
                if (!createdChannel) {
                    throw new ApiError({ code: "CHANNEL_CREATE_FAILED", message: "Failed to create channel", statusCode: 500 });
                }

                await this.serverDB
                    .findByIdAndUpdate(normalizedServerId, { $inc: { channelCount: 1 } }, { session } as never)
                    .exec();

                const responseBody = toChannelResponseDTO(createdChannel as never);
                const response = { statusCode: 201, body: responseBody };

                await this.outboxRepo.create(
                    {
                        eventId: crypto.randomUUID(),
                        type: OutboxEventType.CHANNEL_CREATED,
                        aggregateType: "CHANNEL",
                        aggregateId: createdChannel._id,
                        payload: {
                            channelId: createdChannel._id.toString(),
                            serverId: normalizedServerId.toString(),
                            ownerId: normalizedUserId.toString(),
                            name: createdChannel.name,
                            slug: createdChannel.slug,
                            type: createdChannel.type,
                        },
                        attempts: 0,
                        availableAt: new Date(),
                        status: OutboxEventStatus.PENDING,
                    },
                    session,
                );

                await this.idempotencyRepo.complete(idempotencyRecord._id, response, session);

                result = responseBody;
            });
        } catch (err) {
            if (err instanceof ApiError) throw err;
            if (isDuplicateKeyError(err)) {
                const dupErr = err as { keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown> };
                const isNameDup =
                    dupErr.keyPattern?.["nameNormalized"] ||
                    dupErr.keyValue?.["nameNormalized"] ||
                    String((err as Error).message).includes("nameNormalized");
                if (isNameDup) {
                    throw new ApiError({
                        code: "CHANNEL_ALREADY_EXIST",
                        message: "Channel with this name already exists in this server",
                        statusCode: 409,
                    });
                }
                throw new ApiError({
                    code: "CHANNEL_CREATE_FAILED",
                    message: "Channel slug collision, please retry",
                    statusCode: 409,
                });
            }
            throw new ApiError({
                code: "CHANNEL_CREATE_FAILED",
                message: err instanceof Error ? err.message : "Failed to create channel",
                statusCode: 500,
            });
        } finally {
            await session.endSession();
        }

        return result;
    };
}
