import { Types } from "mongoose";
import { Server, ServerStatus, type ServerDocument } from "../schema/server.schema.js";
import type { CreateServerDTO, UpdateServerDTO } from "../DTO/server.dto.js";

export type ObjectIdLike = string | Types.ObjectId;

function toObjectId(id: ObjectIdLike): Types.ObjectId {
    return id instanceof Types.ObjectId ? id : new Types.ObjectId(id);
}

export class ServerRepository {
    private readonly model = Server;

    async create(data: CreateServerDTO): Promise<ServerDocument> {
        // persist server - strip undefined for exactOptionalPropertyTypes
        const cleaned = Object.fromEntries(
            Object.entries(data).filter(([, v]) => v !== undefined),
        ) as CreateServerDTO;

        if (data.settings) {
            const settings = Object.fromEntries(
                Object.entries(data.settings).filter(([, v]) => v !== undefined),
            );
            if (Object.keys(settings).length > 0) {
                (cleaned as unknown as Record<string, unknown>)["settings"] = settings;
            } else {
                delete (cleaned as unknown as Record<string, unknown>)["settings"];
            }
        }

        return await this.model.create(cleaned as never);
    }

    async findById(serverId: ObjectIdLike): Promise<ServerDocument | null> {
        // retrieve server
        return await this.model.findById(toObjectId(serverId)).exec();
    }

    async findBySlug(slug: string): Promise<ServerDocument | null> {
        // retrieve server
        return this.model.findOne({ slug: slug.toLowerCase().trim() }).exec();
    }

    async findByOwnerId(ownerId: ObjectIdLike): Promise<ServerDocument[]> {
        // retrieve servers - exclude soft-deleted
        return this.model
            .find({ ownerId: toObjectId(ownerId), status: { $ne: ServerStatus.DELETED } } as never)
            .exec() as Promise<ServerDocument[]>;
    }

    async updateDetails(
        serverId: ObjectIdLike,
        data: UpdateServerDTO,
    ): Promise<ServerDocument | null> {
        const setPayload: Record<string, unknown> = {};

        if (data.name !== undefined) setPayload["name"] = data.name;
        if (data.slug !== undefined) setPayload["slug"] = data.slug;
        if (data.description !== undefined) setPayload["description"] = data.description;
        if (data.icon !== undefined) setPayload["icon"] = data.icon;
        if (data.status !== undefined) setPayload["status"] = data.status;
        if (data.memberCount !== undefined) setPayload["memberCount"] = data.memberCount;
        if (data.channelCount !== undefined) setPayload["channelCount"] = data.channelCount;
        if (data.deletedAt !== undefined) setPayload["deletedAt"] = data.deletedAt;

        if (data.settings !== undefined) {
            for (const [k, v] of Object.entries(data.settings)) {
                if (v !== undefined) setPayload[`settings.${k}`] = v;
            }
        }

        if (Object.keys(setPayload).length === 0) return this.findById(serverId);

        return this.model
            .findByIdAndUpdate(toObjectId(serverId), { $set: setPayload }, { new: true, runValidators: true })
            .exec();
    }

    async softDelete(serverId: ObjectIdLike): Promise<ServerDocument | null> {
        // mark deleted
        return this.model
            .findByIdAndUpdate(
                toObjectId(serverId),
                {
                    $set: {
                        status: ServerStatus.DELETED,
                        deletedAt: new Date(),
                        "settings.isDeleted": true,
                    },
                },
                { new: true },
            )
            .exec();
    }

    async incrementMemberCount(
        serverId: ObjectIdLike,
        delta: number,
    ): Promise<ServerDocument | null> {
        // atomic counter
        return this.model
            .findByIdAndUpdate(toObjectId(serverId), { $inc: { memberCount: delta } }, { new: true })
            .exec();
    }

    async incrementChannelCount(
        serverId: ObjectIdLike,
        delta: number,
    ): Promise<ServerDocument | null> {
        // atomic counter
        return this.model
            .findByIdAndUpdate(toObjectId(serverId), { $inc: { channelCount: delta } }, { new: true })
            .exec();
    }
}

// backwards compat exports (previous broken name)
export const serverClass = ServerRepository;
export const serverRepository = new ServerRepository();
