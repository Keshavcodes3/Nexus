export interface ApiErrorOptions {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
    cause?: unknown;
}

export class ApiError extends Error {
    public readonly code: string;
    public readonly statusCode: number;
    public readonly details?: unknown;

    constructor({
        code,
        message,
        statusCode,
        details,
        cause,
    }: ApiErrorOptions) {
        super(message, { cause });

        this.name = "ApiError";
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;

        Error.captureStackTrace(this, ApiError);
    }
}