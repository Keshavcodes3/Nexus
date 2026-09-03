import {
    Schema,
    model,
    Types,
    type Document,
} from "mongoose";

export interface IIdempotency {
    userId: Types.ObjectId;

    key: string;

    operation: string;

    status: "PROCESSING" | "COMPLETED" | "FAILED";

    response?: {
        statusCode: number;
        body: unknown;
    };

    lockedAt: Date;

    completedAt?: Date;

    expiresAt: Date;

    createdAt: Date;
    updatedAt: Date;
}

export type IdempotencyDocument = IIdempotency & Document;

const idempotencySchema = new Schema<IdempotencyDocument>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        key: {
            type: String,
            required: true,
            trim: true,
            maxlength: 128,
        },

        operation: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },

        status: {
            type: String,
            enum: ["PROCESSING", "COMPLETED", "FAILED"],
            default: "PROCESSING",
            required: true,
            index: true,
        },

        response: {
            statusCode: {
                type: Number,
            },

            body: {
                type: Schema.Types.Mixed,
            },
        },

        lockedAt: {
            type: Date,
            default: Date.now,
            required: true,
        },

        completedAt: {
            type: Date,
        },

        expiresAt: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

/**
 * One idempotency key can only represent one operation
 * for a particular user.
 */
idempotencySchema.index(
    {
        userId: 1,
        operation: 1,
        key: 1,
    },
    {
        unique: true,
    }
);

/**
 * MongoDB automatically removes expired records.
 */
idempotencySchema.index(
    {
        expiresAt: 1,
    },
    {
        expireAfterSeconds: 0,
    }
);

export const Idempotency = model<IdempotencyDocument>(
    "Idempotency",
    idempotencySchema
);