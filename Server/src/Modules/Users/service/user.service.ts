import { ApiError } from "../../../shared/HTTP/api-error.js";
import { userRepository } from "../repository/user.repository.js";
import type { UserDocument } from "../schema/user.schema.js";

export interface UpdateProfileInput {
    displayName?: string | undefined;
    bio?: string | undefined;
    avatarUrl?: string | undefined;
    bannerUrl?: string | undefined;
    status?: UserDocument["status"] | undefined;
    customStatus?: string | undefined;
}

function toPublicUser(user: UserDocument) {
    // Mongoose toObject strips passwordHash already via transform, but do explicit
    const obj = user.toObject() as Record<string, unknown>;
    delete obj["passwordHash"];
    delete obj["__v"];
    return {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
        bannerUrl: user.bannerUrl ?? null,
        bio: user.bio ?? "",
        status: user.status,
        customStatus: user.customStatus ?? null,
        isVerified: user.isVerified,
        isBot: user.isBot,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}

export class UserService {
    async getById(id: string) {
        const user = await userRepository.findById(id);
        if (!user) {
            throw new ApiError({
                code: "USER_NOT_FOUND",
                message: "User not found",
                statusCode: 404,
            });
        }
        return toPublicUser(user);
    }

    async getPublicProfile(id: string) {
        const user = await userRepository.findById(id);
        if (!user) {
            throw new ApiError({
                code: "USER_NOT_FOUND",
                message: "User not found",
                statusCode: 404,
            });
        }
        // Public profile hides email
        const pub = toPublicUser(user);
        const { email: _email, ...withoutEmail } = pub as unknown as Record<string, unknown>;
        void _email;
        return withoutEmail;
    }

    async updateProfile(userId: string, input: UpdateProfileInput) {
        const allowed: Partial<Record<keyof UpdateProfileInput, unknown>> = {};
        if (input.displayName !== undefined) allowed["displayName"] = input.displayName;
        if (input.bio !== undefined) allowed["bio"] = input.bio;
        if (input.avatarUrl !== undefined) allowed["avatarUrl"] = input.avatarUrl;
        if (input.bannerUrl !== undefined) allowed["bannerUrl"] = input.bannerUrl;
        if (input.status !== undefined) allowed["status"] = input.status;
        if (input.customStatus !== undefined) allowed["customStatus"] = input.customStatus;

        if (Object.keys(allowed).length === 0) {
            throw new ApiError({
                code: "VALIDATION_ERROR",
                message: "No valid fields to update",
                statusCode: 400,
            });
        }

        const updated = await userRepository.updateById(
            userId,
            allowed as Partial<UserDocument>,
        );
        if (!updated) {
            throw new ApiError({
                code: "USER_NOT_FOUND",
                message: "User not found",
                statusCode: 404,
            });
        }
        return toPublicUser(updated);
    }

    async searchUsers(query: string, limit = 10) {
        const users = await userRepository.search(query, limit);
        return users.map((u) => {
            const pub = toPublicUser(u);
            const { email: _email, ...rest } = pub as unknown as Record<string, unknown>;
            void _email;
            return rest;
        });
    }

    async getMe(userId: string) {
        return this.getById(userId);
    }
}

export const userService = new UserService();
