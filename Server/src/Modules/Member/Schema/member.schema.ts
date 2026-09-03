import { Schema, model, Types, type Document } from "mongoose";

export interface IMember {
    serverId: Types.ObjectId;
    userId: Types.ObjectId;

    role: "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER";

    nickname?: string;

    joinedAt: Date;
    lastSeenAt?: Date;

    isMuted: boolean;
    isBanned: boolean;

    createdAt: Date;
    updatedAt: Date;
}

export type MemberDocument = IMember & Document;

const memberSchema = new Schema<MemberDocument>(
    {
        serverId: {
            type: Schema.Types.ObjectId,
            ref: "Server",
            required: true,
            index: true,
        },

        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        role: {
            type: String,
            enum: ["OWNER", "ADMIN", "MODERATOR", "MEMBER"],
            default: "MEMBER",
            index: true,
        },

        nickname: {
            type: String,
            trim: true,
            maxlength: 32,
        },

        joinedAt: {
            type: Date,
            default: Date.now,
        },

        lastSeenAt: {
            type: Date,
        },

        isMuted: {
            type: Boolean,
            default: false,
        },

        isBanned: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

/**
 * A user can belong to a server only once.
 */
memberSchema.index(
    { serverId: 1, userId: 1 },
    { unique: true }
);

/**
 * Useful for fetching all members of a server by role.
 */
memberSchema.index({ serverId: 1, role: 1 });

export const Member = model<MemberDocument>(
    "Member",
    memberSchema
);