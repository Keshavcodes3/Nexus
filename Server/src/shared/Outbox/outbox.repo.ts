import type { ClientSession } from "mongoose";
import {
    OutboxEvent,
    type OutboxEventDocument,
    type IOutboxEvent,
} from "./outbox.schema.js"

export class OutboxRepository {

    private readonly db = OutboxEvent;

    async create(
        data: Omit<IOutboxEvent, "createdAt" | "updatedAt" | "attempts" | "availableAt"> & {
            attempts?: number;
            availableAt?: Date;
        },
        session?: ClientSession | null,
    ): Promise<OutboxEventDocument> {
        const payload = {
            ...data,
            attempts: data.attempts ?? 0,
            availableAt: data.availableAt ?? new Date(),
        } as Omit<IOutboxEvent, "createdAt" | "updatedAt">;

        const [event] = await this.db.create(
            [payload],
            session ? { session } : {},
        );

        return event as OutboxEventDocument;
    }

    async createChannelEvent(
        data: Omit<IOutboxEvent, "createdAt" | "updatedAt" | "attempts" | "availableAt"> & {
            attempts?: number;
            availableAt?: Date;
        },
        session?: ClientSession | null,
    ): Promise<OutboxEventDocument> {
        return this.create(data, session);
    }
}