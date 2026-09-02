import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../../../config/env.js";

export interface AccessTokenPayload {
    userId: string;
    username: string;
    email: string;
}

export interface RefreshTokenPayload {
    userId: string;
    tokenId: string; // jti - unique id for rotation tracking
}

export function generateAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload & {
        iat: number;
        exp: number;
    };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload & {
        iat: number;
        exp: number;
    };
}

export function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateTokenId(): string {
    return crypto.randomBytes(32).toString("hex");
}
