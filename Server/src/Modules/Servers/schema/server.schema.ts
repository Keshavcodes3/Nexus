import { Schema, model, type HydratedDocument, type Model } from "mongoose";

export enum ServerStatus {
    ACTIVE = "ACTIVE",
    SUSPENDED = "SUSPENDED",
    DELETED = "DELETED",
}

export enum VerificationLevel {
    NONE = "NONE",
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
}

export interface IServerSettings {
    isPublic: boolean;
    allowInvites: boolean;
    verificationLevel: VerificationLevel;
    isDeleted: boolean
}

export interface IServer {
    name: string;
    slug: string;
    description?: string;

    icon?: {
        url: string;
        publicId?: string;
    };

    ownerId: Schema.Types.ObjectId;

    status: ServerStatus;

    settings: IServerSettings;

    memberCount: number;
    channelCount: number;

    deletedAt?: Date | null;

    createdAt: Date;
    updatedAt: Date;
}

export type ServerDocument = HydratedDocument<IServer>;


const serverSettingsSchema = new Schema<IServerSettings>(
    {
        isPublic: {
            type: Boolean,
            default: true,
            required: true,
        },

        allowInvites: {
            type: Boolean,
            default: true,
            required: true,
        },

        verificationLevel: {
            type: String,
            enum: Object.values(VerificationLevel),
            default: VerificationLevel.NONE,
            required: true,
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    {
        _id: false,
    },
);


const serverIconSchema = new Schema(
    {
        url: {
            type: String,
            required: true,
            trim: true,
        },

        publicId: {
            type: String,
            trim: true,
        },
    },
    {
        _id: false,
    },
);

const serverSchema = new Schema<IServer>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 100,
        },

        slug: {
            type: String,
            required: true,
            unique: true,
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

        icon: {
            type: serverIconSchema,
            default: null,
        },

        ownerId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        status: {
            type: String,
            enum: Object.values(ServerStatus),
            default: ServerStatus.ACTIVE,
            required: true,
            index: true,
        },

        settings: {
            type: serverSettingsSchema,
            required: true,
            default: () => ({}),
            
        },

        memberCount: {
            type: Number,
            default: 1,
            min: 0,
        },
        channelCount: {
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

        collection: "servers",
    },
);

serverSchema.index(
    { slug: 1 },
    {
        unique: true,
        name: "idx_servers_slug_unique",
    },
);

/**
 * Find servers owned by a user.
 */
serverSchema.index(
    { ownerId: 1, status: 1 },
    {
        name: "idx_servers_owner_status",
    },
);

/**
 * Useful for server discovery/listing.
 */
serverSchema.index(
    { status: 1, createdAt: -1 },
    {
        name: "idx_servers_status_createdAt",
    },
);

/* ============================================================
 * Model
 * ============================================================ */

export const Server: Model<IServer> = model<IServer>(
    "Server",
    serverSchema,
);