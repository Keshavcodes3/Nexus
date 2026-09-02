import type { DomainEvent } from "./domain-event.js";

export interface EventHandler<TPayload = unknown> {
    handle(event: DomainEvent<TPayload>): Promise<void>;
}