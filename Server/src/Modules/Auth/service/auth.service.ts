import bcrypt from "bcryptjs";
import { ApiError } from "../../../shared/HTTP/api-error.js";
import { userRepository } from "../../Users/repository/user.repository.js";
import { authRepository } from "../repository/auth.repository.js";
import {
    generateAccessToken,
    generateRefreshToken,
    generateTokenId,
    hashToken,
    verifyRefreshToken,
} from "./token.service.js";
import type { RegisterInput, LoginInput } from "../schema/auth.validation.js";

const SALT_ROUNDS = 10;

function toPublicUser(user: { _id: { toString(): string }; username: string; email: string; displayName: string; avatarUrl?: string | null; bannerUrl?: string | null; bio?: string; status: string; customStatus?: string | null; isVerified: boolean; isBot: boolean; createdAt: Date; updatedAt: Date }) {
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

export class AuthService {
    async register(input: RegisterInput, meta?: { ip?: string | undefined; userAgent?: string | undefined }) {
        const { username, email, password, displayName } = input;

        const existing = await userRepository.findByEmailOrUsername(email, username);
        if (existing) {
            const field = existing.email.toLowerCase() === email.toLowerCase() ? "email" : "username";
            throw new ApiError({
                code: "ALREADY_EXISTS",
                message: `${field} already taken`,
                statusCode: 409,
            });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const user = await userRepository.create({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            passwordHash,
            displayName: displayName?.trim() || username,
        } as unknown as Record<string, unknown>);

        const tokens = await this.issueTokens(
            user._id.toString(),
            user.username,
            user.email,
            meta,
        );

        return {
            user: toPublicUser(user as unknown as Parameters<typeof toPublicUser>[0]),
            ...tokens,
        };
    }

    async login(input: LoginInput, meta?: { ip?: string | undefined; userAgent?: string | undefined }) {
        const { identifier, password } = input;

        const user = await userRepository.findByUsernameOrEmailWithPassword(identifier);
        if (!user) {
            throw new ApiError({
                code: "INVALID_CREDENTIALS",
                message: "Invalid credentials",
                statusCode: 401,
            });
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            throw new ApiError({
                code: "INVALID_CREDENTIALS",
                message: "Invalid credentials",
                statusCode: 401,
            });
        }

        // Optionally update status to online on login
        if (user.status === "offline") {
            await userRepository.updateById(user._id.toString(), { status: "online" } as unknown as Record<string, unknown>);
        }

        const tokens = await this.issueTokens(
            user._id.toString(),
            user.username,
            user.email,
            meta,
        );

        const freshUser = await userRepository.findById(user._id.toString());
        if (!freshUser) throw new ApiError({ code: "USER_NOT_FOUND", message: "User not found", statusCode: 404 });

        return {
            user: toPublicUser(freshUser as unknown as Parameters<typeof toPublicUser>[0]),
            ...tokens,
        };
    }

    async refresh(refreshToken: string, meta?: { ip?: string | undefined; userAgent?: string | undefined }) {
        if (!refreshToken) {
            throw new ApiError({
                code: "UNAUTHORIZED",
                message: "Refresh token required",
                statusCode: 401,
            });
        }

        let payload: { userId: string; tokenId: string };
        try {
            payload = verifyRefreshToken(refreshToken);
        } catch {
            throw new ApiError({
                code: "UNAUTHORIZED",
                message: "Invalid or expired refresh token",
                statusCode: 401,
            });
        }

        const tokenHash = hashToken(refreshToken);
        const stored = await authRepository.findByTokenHash(tokenHash);

        if (!stored || stored.revokedAt) {
            throw new ApiError({
                code: "UNAUTHORIZED",
                message: "Refresh token revoked or not found",
                statusCode: 401,
            });
        }

        if (stored.expiresAt < new Date()) {
            await authRepository.deleteByTokenHash(tokenHash);
            throw new ApiError({
                code: "UNAUTHORIZED",
                message: "Refresh token expired",
                statusCode: 401,
            });
        }

        // Rotate: revoke old, issue new
        await authRepository.revokeByTokenHash(tokenHash);

        const user = await userRepository.findById(payload.userId);
        if (!user) {
            throw new ApiError({
                code: "USER_NOT_FOUND",
                message: "User not found",
                statusCode: 404,
            });
        }

        const tokens = await this.issueTokens(user._id.toString(), user.username, user.email, meta);

        return {
            user: toPublicUser(user as unknown as Parameters<typeof toPublicUser>[0]),
            ...tokens,
        };
    }

    async logout(refreshToken: string) {
        if (!refreshToken) return;
        const tokenHash = hashToken(refreshToken);
        await authRepository.revokeByTokenHash(tokenHash);
    }

    async logoutAll(userId: string) {
        await authRepository.revokeAllForUser(userId);
    }

    private async issueTokens(
        userId: string,
        username: string,
        email: string,
        meta?: { ip?: string | undefined; userAgent?: string | undefined },
    ) {
        const accessToken = generateAccessToken({ userId, username, email });
        const tokenId = generateTokenId();
        const refreshToken = generateRefreshToken({ userId, tokenId });
        const tokenHash = hashToken(refreshToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7d

        await authRepository.createRefreshToken({
            userId,
            tokenHash,
            expiresAt,
            ip: meta?.ip,
            userAgent: meta?.userAgent,
        });

        return { accessToken, refreshToken };
    }
}

export const authService = new AuthService();
