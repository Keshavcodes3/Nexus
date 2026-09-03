import type { ClientSession } from "mongoose";
import { Types } from "mongoose";
import { Idempotency } from "./idempotency.schema.js";

export interface CreateIdempotencyData {
    userId: Types.ObjectId;
    key: string;
    operation: string;
    status: "PROCESSING" | "COMPLETED" | "FAILED";
    response?: {
        statusCode: number;
        body: unknown;
    } | undefined;
    lockedAt: Date;
    completedAt?: Date | undefined;
    expiresAt?: Date | undefined;
}

export class IdempotencyRepository {

    async find(
        userId: Types.ObjectId,
        operation: string,
        key: string,
        session: ClientSession
    ) {
        return Idempotency.findOne({
            userId,
            operation,
            key,
        }).session(session).exec();
    }

    async create(
        data: CreateIdempotencyData,
        session: ClientSession
    ) {
        const payload: Record<string, unknown> = {
            userId: data.userId,
            key: data.key,
            operation: data.operation,
            status: data.status,
            lockedAt: data.lockedAt,
            expiresAt: data.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
        };
        if (data.response !== undefined) payload["response"] = data.response;
        if (data.completedAt !== undefined) payload["completedAt"] = data.completedAt;

        const [record] = await Idempotency.create(
            [payload as never],
            { session }
        );

        return record;
    }

    async complete(
        id: Types.ObjectId,
        response: unknown,
        session: ClientSession
    ) {
        return Idempotency.findByIdAndUpdate(
            id,
            {
                $set: {
                    status: "COMPLETED",
                    response,
                    completedAt: new Date(),
                },
            },
            {
                new: true,
                session,
            }
        ).exec();
    }
}
