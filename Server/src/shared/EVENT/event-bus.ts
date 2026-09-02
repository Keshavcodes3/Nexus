import type { DomainEvent } from "./domain-event.js";
import type { EventHandler } from "./event-handler.js";

export interface EventBus {
    publish<TPayload>(
        event: DomainEvent<TPayload>,
    ): Promise<void>;

    subscribe<TPayload>(
        eventType: string,
        handler: EventHandler<TPayload>,
    ): void;
}