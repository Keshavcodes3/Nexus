export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
    message: string;
}

export function apiSuccess<T>(
    data: T,
    message = "Success",
): ApiSuccessResponse<T> {
    return {
        success: true,
        data,
        message,
    };
}