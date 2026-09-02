export interface DomainEvent<TPayload = unknown> {
    readonly id: string;
    readonly type: string;
    readonly occurredAt: Date;
    readonly payload: TPayload;
}