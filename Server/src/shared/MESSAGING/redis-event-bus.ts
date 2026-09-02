import { Redis } from "ioredis";

import type { EventBus } from "../EVENT/event-bus.js";
import type { DomainEvent } from "../EVENT/domain-event.js";
import type { EventHandler } from "../EVENT/event-handler.js";

export class RedisEventBus implements EventBus {
    private readonly handlers = new Map<
        string,
        EventHandler[]
    >();

    private readonly subscriber: Redis;
    private readonly publisher: Redis;

    constructor(
        publisher: Redis,
        subscriber: Redis,
    ) {
        this.publisher = publisher;
        this.subscriber = subscriber;
    }

    async publish<TPayload>(
        event: DomainEvent<TPayload>,
    ): Promise<void> {
        await this.publisher.publish(
            `event:${event.type}`,
            JSON.stringify(event),
        );
    }

    subscribe<TPayload>(
        eventType: string,
        handler: EventHandler<TPayload>,
    ): void {
        const handlers = this.handlers.get(eventType) ?? [];

        handlers.push(handler);

        this.handlers.set(eventType, handlers);

        void this.subscriber.subscribe(
            `event:${eventType}`,
        );
    }

    async start(): Promise<void> {
        this.subscriber.on(
            "message",
            async (channel: string, message: string) => {
                const eventType = channel.replace(
                    "event:",
                    "",
                );

                const handlers =
                    this.handlers.get(eventType) ?? [];

                const event = JSON.parse(message);

                await Promise.all(
                    handlers.map((handler) =>
                        handler.handle(event),
                    ),
                );
            },
        );
    }
}