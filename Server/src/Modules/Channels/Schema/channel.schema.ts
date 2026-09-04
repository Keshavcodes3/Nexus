import { Schema, model, Types, type HydratedDocument, type Model } from "mongoose";

export enum ChannelStatus {
    ACTIVE = "ACTIVE",
    SUSPENDED = "SUSPENDED",
    DELETED = "DELETED",
}

export enum ChannelType {
    TEXT = "TEXT",
    VOICE = "VOICE",
    ANNOUNCEMENT = "ANNOUNCEMENT",
}

export interface IChannel {
    name: string;
    nameNormalized: string;
    slug: string;
    description?: string;

    serverId: Types.ObjectId;
    ownerId: Types.ObjectId;

    type: ChannelType;
    status: ChannelStatus;

    position: number;
    
    memberCount: number;
    deletedAt?: Date | null;

    createdAt: Date;
    updatedAt: Date;
}

export type ChannelDocument = HydratedDocument<IChannel>;

const channelSchema = new Schema<IChannel>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 100,
        },

        nameNormalized: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            minlength: 1,
            maxlength: 100,
            index: true,
        },

        slug: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            minlength: 1,
            maxlength: 100,
            match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500,
        },

        serverId: {
            type: Schema.Types.ObjectId,
            ref: "Server",
            required: true,
            index: true,
        },

        ownerId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        type: {
            type: String,
            enum: Object.values(ChannelType),
            default: ChannelType.TEXT,
            required: true,
            index: true,
        },

        status: {
            type: String,
            enum: Object.values(ChannelStatus),
            default: ChannelStatus.ACTIVE,
            required: true,
            index: true,
        },

        position: {
            type: Number,
            default: 0,
            min: 0,
        },

        memberCount: {
            type: Number,
            default: 0,
            min: 0,
        },

        deletedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: "channels",
    },
);

export function normalizeChannelName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// alias requested as `normalizedChannelName`
export const normalizedChannelName = normalizeChannelName;

(channelSchema as unknown as { pre: (hook: string, fn: (next: (err?: Error) => void) => void) => void }).pre("validate", function (this: any, next: (err?: Error) => void) {
    if (this.isModified("name") || this.isNew) {
        const raw = (this as unknown as { name?: string }).name;
        if (typeof raw === "string" && raw.trim()) {
            (this as unknown as { nameNormalized: string }).nameNormalized = normalizeChannelName(raw);
        }
    }
    next();
});

// Global slug uniqueness handled via { serverId, slug } compound unique instead of global unique
channelSchema.index(
    { slug: 1 },
    {
        unique: true,
        name: "idx_channels_slug_unique",
    },
);

// Enforce {serverId, nameNormalized} unique only for non-deleted channels
channelSchema.index(
    { serverId: 1, nameNormalized: 1 },
    {
        unique: true,
        name: "idx_channels_server_name_unique",
        partialFilterExpression: { status: { $ne: "DELETED" }, nameNormalized: { $exists: true } },
    },
);

// Enforce {serverId, slug} unique only for non-deleted channels
channelSchema.index(
    { serverId: 1, slug: 1 },
    {
        unique: true,
        name: "idx_channels_server_slug_unique",
        partialFilterExpression: { status: { $ne: "DELETED" } },
    },
);

channelSchema.index(
    { serverId: 1, status: 1 },
    {
        name: "idx_channels_server_status",
    },
);

channelSchema.index(
    { serverId: 1, position: 1 },
    {
        name: "idx_channels_server_position",
    },
);

channelSchema.index(
    { ownerId: 1, status: 1 },
    {
        name: "idx_channels_owner_status",
    },
);

/* ============================================================
 * Model
 * ============================================================ */

export const Channel: Model<IChannel> = model<IChannel>("Channel", channelSchema);

// backwards compat: previous file exported lowercase `channel`
export const channel = Channel;

// backwards compat: Server service previously imported Member from this file
export { Member } from "../../Member/Schema/member.schema.js";
