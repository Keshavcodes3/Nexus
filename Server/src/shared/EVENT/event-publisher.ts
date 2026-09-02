import type { DomainEvent } from "./domain-event.js";

export interface EventPublisher {
    publish<TPayload>(
        event: DomainEvent<TPayload>,
    ): Promise<void>;
}