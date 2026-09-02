import { RefreshTokenModel } from "../schema/refresh-token.schema.js";

export class AuthRepository {
    async createRefreshToken(data: {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
        ip?: string | undefined;
        userAgent?: string | undefined;
    }) {
        return RefreshTokenModel.create({
            userId: data.userId,
            tokenHash: data.tokenHash,
            expiresAt: data.expiresAt,
            ip: data.ip ?? null,
            userAgent: data.userAgent ?? null,
        });
    }

    async findByTokenHash(tokenHash: string) {
        return RefreshTokenModel.findOne({ tokenHash }).exec();
    }

    async revokeByTokenHash(tokenHash: string) {
        return RefreshTokenModel.findOneAndUpdate(
            { tokenHash },
            { revokedAt: new Date() },
            { new: true },
        ).exec();
    }

    async revokeAllForUser(userId: string) {
        return RefreshTokenModel.updateMany(
            { userId, revokedAt: null },
            { revokedAt: new Date() },
        ).exec();
    }

    async deleteByTokenHash(tokenHash: string) {
        return RefreshTokenModel.deleteOne({ tokenHash }).exec();
    }
}

export const authRepository = new AuthRepository();
