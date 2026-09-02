import mongoose, { Document, Schema, Types } from "mongoose";

export interface RefreshTokenDocument extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    revokedAt?: Date | null;
    ip?: string | null;
    userAgent?: string | null;
}

const refreshTokenSchema = new Schema<RefreshTokenDocument>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
        revokedAt: {
            type: Date,
            default: null,
        },
        ip: { type: String, default: null },
        userAgent: { type: String, default: null },
    },
    { timestamps: true },
);

// TTL index - auto remove expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = mongoose.model<RefreshTokenDocument>(
    "RefreshToken",
    refreshTokenSchema,
);
