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
    nameNormalized: string;
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

        nameNormalized: {
            type: String,
            required: false,
            trim: true,
            lowercase: true,
            minlength: 1,
            maxlength: 100,
            index: true,
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

export function normalizeServerName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
}

(serverSchema as unknown as { pre: (hook: string, fn: (next: (err?: Error) => void) => void) => void }).pre("validate", function (this: any, next: (err?: Error) => void) {
    if (this.isModified("name") || this.isNew) {
        const raw = (this as unknown as { name?: string }).name;
        if (typeof raw === "string" && raw.trim()) {
            (this as unknown as { nameNormalized: string }).nameNormalized = normalizeServerName(raw);
        }
    }
    next();
});

serverSchema.index(
    { slug: 1 },
    {
        unique: true,
        name: "idx_servers_slug_unique",
    },
);

// Enforce {ownerId, nameNormalized} unique only for non-deleted servers
// Allows reuse after soft-delete and handles case-insensitive + whitespace-insensitive uniqueness
serverSchema.index(
    { ownerId: 1, nameNormalized: 1 },
    {
        unique: true,
        name: "idx_servers_owner_name_unique",
        partialFilterExpression: { status: { $ne: "DELETED" }, nameNormalized: { $exists: true } },
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