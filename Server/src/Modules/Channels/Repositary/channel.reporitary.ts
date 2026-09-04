import { Types } from "mongoose";
import { Channel, ChannelStatus, normalizeChannelName, type ChannelDocument } from "../Schema/channel.schema.js";
import type { CreateChannelDTO, UpdateChannelDTO } from "../DTO/channel.dto.js";

export type ObjectIdLike = string | Types.ObjectId;

function toObjectId(id: ObjectIdLike): Types.ObjectId {
    return id instanceof Types.ObjectId ? id : new Types.ObjectId(id);
}

export class ChannelRepository {
    private readonly model = Channel;

    async create(data: CreateChannelDTO): Promise<ChannelDocument> {
        const cleaned = Object.fromEntries(
            Object.entries(data).filter(([, v]) => v !== undefined),
        ) as CreateChannelDTO;

        return (await this.model.create(cleaned as never)) as ChannelDocument;
    }

    async findById(channelId: ObjectIdLike): Promise<ChannelDocument | null> {
        return this.model.findById(toObjectId(channelId)).exec();
    }

    async findBySlug(slug: string): Promise<ChannelDocument | null> {
        return this.model.findOne({ slug: slug.toLowerCase().trim() }).exec();
    }

    async findByServerAndId(
        serverId: ObjectIdLike,
        channelId: ObjectIdLike,
    ): Promise<ChannelDocument | null> {
        return this.model
            .findOne({
                _id: toObjectId(channelId),
                serverId: toObjectId(serverId),
            })
            .exec();
    }

    /**
     * Find channel by normalized name inside a server.
     * Uses same normalization as schema hook (trim + lowercase + collapse spaces).
     */
    async findByNormalizedName(
        serverId: ObjectIdLike,
        name: string,
    ): Promise<ChannelDocument | null> {
        const nameNormalized = normalizeChannelName(name);
        return this.model
            .findOne({
                serverId: toObjectId(serverId),
                nameNormalized,
                status: { $ne: ChannelStatus.DELETED },
            } as never)
            .exec();
    }

    async findByName(
        serverId: ObjectIdLike,
        nameNormalized: string,
    ): Promise<ChannelDocument | null> {
        return this.findByNormalizedName(serverId, nameNormalized);
    }

    async findByServer(serverId: ObjectIdLike): Promise<ChannelDocument[]> {
        return this.model
            .find({
                serverId: toObjectId(serverId),
                status: { $ne: ChannelStatus.DELETED },
            } as never)
            .sort({
                position: 1,
                createdAt: 1,
            })
            .exec() as Promise<ChannelDocument[]>;
    }

    async findByOwnerId(ownerId: ObjectIdLike): Promise<ChannelDocument[]> {
        return this.model
            .find({ ownerId: toObjectId(ownerId), status: { $ne: ChannelStatus.DELETED } } as never)
            .exec() as Promise<ChannelDocument[]>;
    }

    async updateDetails(
        channelId: ObjectIdLike,
        data: UpdateChannelDTO,
    ): Promise<ChannelDocument | null> {
        const setPayload: Record<string, unknown> = {};

        if (data.name !== undefined) setPayload["name"] = data.name;
        if (data.nameNormalized !== undefined) setPayload["nameNormalized"] = data.nameNormalized;
        if (data.slug !== undefined) setPayload["slug"] = data.slug;
        if (data.description !== undefined) setPayload["description"] = data.description;
        if (data.type !== undefined) setPayload["type"] = data.type;
        if (data.status !== undefined) setPayload["status"] = data.status;
        if (data.position !== undefined) setPayload["position"] = data.position;
        if (data.memberCount !== undefined) setPayload["memberCount"] = data.memberCount;
        if (data.deletedAt !== undefined) setPayload["deletedAt"] = data.deletedAt;

        if (Object.keys(setPayload).length === 0) return this.findById(channelId);

        return this.model
            .findByIdAndUpdate(toObjectId(channelId), { $set: setPayload }, { new: true, runValidators: true })
            .exec();
    }

    // kept for backwards compat with previous `update` name
    async update(
        channelId: ObjectIdLike,
        data: UpdateChannelDTO,
    ): Promise<ChannelDocument | null> {
        return this.updateDetails(channelId, data);
    }

    async softDelete(channelId: ObjectIdLike): Promise<ChannelDocument | null> {
        return this.model
            .findByIdAndUpdate(
                toObjectId(channelId),
                {
                    $set: {
                        status: ChannelStatus.DELETED,
                        deletedAt: new Date(),
                    },
                },
                { new: true },
            )
            .exec();
    }

    // alias - previous name was `archive`
    async archive(channelId: ObjectIdLike, deletedAt: Date = new Date()): Promise<ChannelDocument | null> {
        return this.model
            .findByIdAndUpdate(
                toObjectId(channelId),
                {
                    $set: {
                        status: ChannelStatus.DELETED,
                        deletedAt,
                    },
                },
                { new: true, runValidators: true },
            )
            .exec();
    }

    async incrementMemberCount(
        channelId: ObjectIdLike,
        delta: number,
    ): Promise<ChannelDocument | null> {
        return this.model
            .findByIdAndUpdate(toObjectId(channelId), { $inc: { memberCount: delta } }, { new: true })
            .exec();
    }
}

// backwards compat exports (previous broken names)
export const channelRepositaryClass = ChannelRepository;
export const ChannelRepositaryClass = ChannelRepository;
export const channelRepository = new ChannelRepository();
export const channelRepositary = new ChannelRepository();
