import type { ClientSession } from "mongoose";
import {
    OutboxEvent,
    type OutboxEventDocument,
    type IOutboxEvent,
} from "./outbox.schema.js"

export class OutboxRepository {

    private readonly db = OutboxEvent;

    async create(
        data: Omit<
            IOutboxEvent,
            "createdAt" |
            "updatedAt"
        >,
        session: ClientSession
    ) {

        const [event] = await this.db.create(
            [data],
            { session }
        );

        return event;
    }
}