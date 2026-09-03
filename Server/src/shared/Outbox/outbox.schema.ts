import {
    Schema,
    model,
    Types,
    type Document,
} from "mongoose";

export enum OutboxEventStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    PUBLISHED = "PUBLISHED",
    FAILED = "FAILED",
}

export enum OutboxEventType {
    SERVER_CREATED = "SERVER_CREATED",
    SERVER_UPDATED = "SERVER_UPDATED",
    SERVER_DELETED = "SERVER_DELETED",

    MEMBER_JOINED = "MEMBER_JOINED",
    MEMBER_LEFT = "MEMBER_LEFT",

    CHANNEL_CREATED = "CHANNEL_CREATED",
}

export interface IOutboxEvent {
    eventId: string;

    type: OutboxEventType;

    aggregateType: "SERVER" | "MEMBER" | "CHANNEL";

    aggregateId: Types.ObjectId;

    payload: Record<string, unknown>;

    status: OutboxEventStatus;

    attempts: number;

    availableAt: Date;

    processedAt?: Date;

    lastError?: string;

    createdAt: Date;
    updatedAt: Date;
}

export type OutboxEventDocument = IOutboxEvent & Document;

const outboxEventSchema = new Schema<OutboxEventDocument>(
    {
  
        eventId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },


        type: {
            type: String,
            enum: Object.values(OutboxEventType),
            required: true,
            index: true,
        },

        aggregateType: {
            type: String,
            enum: ["SERVER", "MEMBER", "CHANNEL"],
            required: true,
            index: true,
        },

        aggregateId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
        },

        payload: {
            type: Schema.Types.Mixed,
            required: true,
        },

        status: {
            type: String,
            enum: Object.values(OutboxEventStatus),
            default: OutboxEventStatus.PENDING,
            required: true,
            index: true,
        },


        attempts: {
            type: Number,
            default: 0,
            min: 0,
        },
        availableAt: {
            type: Date,
            default: Date.now,
            index: true,
        },

        processedAt: {
            type: Date,
        },

        lastError: {
            type: String,
            maxlength: 5000,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

/**
 * Main polling index.
 */
outboxEventSchema.index({
    status: 1,
    availableAt: 1,
    createdAt: 1,
});

/**
 * Useful for aggregate-specific event queries.
 */
outboxEventSchema.index({
    aggregateType: 1,
    aggregateId: 1,
    createdAt: 1,
});

export const OutboxEvent = model<OutboxEventDocument>(
    "OutboxEvent",
    outboxEventSchema
);