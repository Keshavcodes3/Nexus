import { Types } from "mongoose";
import { z } from "zod";
import {
    ServerStatus,
    VerificationLevel,
    type IServer,
    type IServerSettings,
} from "../schema/server.schema.js";

// Re-export enums so DTO layer stays in sync with schema
export { ServerStatus, VerificationLevel };

export interface ServerIconDTO {
    url: string;
    publicId?: string | undefined;
}

export interface ServerSettingsDTO {
    isPublic?: boolean | undefined;
    allowInvites?: boolean | undefined;
    verificationLevel?: VerificationLevel | undefined;
    isDeleted?: boolean | undefined;
}

export interface CreateServerDTO {
    name: string;
    description?: string | undefined;
    icon?: ServerIconDTO | null | undefined;
    ownerId: Types.ObjectId;
    status?: ServerStatus | undefined;
    settings?: ServerSettingsDTO | undefined;
    memberCount?: number | undefined;
    channelCount?: number | undefined;
    idempotencyKey: string,
}

export type createServerDTO = CreateServerDTO;



export interface CreateServerInputDTO {
    name: string;
    slug?: string | undefined;
    description?: string | undefined;
    icon?: ServerIconDTO | null | undefined;
    settings?: ServerSettingsDTO | undefined;
}

export interface UpdateServerDTO {
    name?: string | undefined;
    nameNormalized?: string | undefined;
    slug?: string | undefined;
    description?: string | null | undefined;
    icon?: ServerIconDTO | null | undefined;
    status?: ServerStatus | undefined;
    settings?: ServerSettingsDTO | undefined;
    memberCount?: number | undefined;
    channelCount?: number | undefined;
    deletedAt?: Date | null | undefined;
}

export interface ServerResponseDTO {
    _id: string;
    id: string;
    name: string;
    slug: string;
    description?: string | null | undefined;
    icon: ServerIconDTO | null;
    ownerId: string;
    status: ServerStatus;
    settings: IServerSettings;
    isDeleted: boolean;
    memberCount: number;
    channelCount: number;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export function toServerResponseDTO(doc: IServer & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date }): ServerResponseDTO {
    const idStr = doc._id.toString();
    return {
        _id: idStr,
        id: idStr,
        name: doc.name,
        slug: doc.slug,
        description: doc.description ?? null,
        icon: doc.icon ? { url: doc.icon.url, publicId: doc.icon.publicId } : null,
        ownerId: doc.ownerId.toString(),
        status: doc.status,
        settings: doc.settings,
        isDeleted: doc.settings?.isDeleted ?? false,
        memberCount: doc.memberCount,
        channelCount: doc.channelCount,
        deletedAt: doc.deletedAt ?? null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

// Zod schemas moved from controller - single source of truth for validation
export const createServerSchema = z.object({
    name: z.string().min(1, "Name is required").max(100).trim(),
    description: z.string().max(500).trim().optional(),
    icon: z
        .object({
            url: z.string().url(),
            publicId: z.string().trim().optional(),
        })
        .nullable()
        .optional(),
    settings: z
        .object({
            isPublic: z.boolean().optional(),
            allowInvites: z.boolean().optional(),
            verificationLevel: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).optional(),
            isDeleted: z.boolean().optional(),
        })
        .optional(),
});

export const updateServerSchema = z.object({
    name: z.string().min(1).max(100).trim().optional(),
    title: z.string().min(1).max(100).trim().optional(),
    description: z.string().max(500).trim().nullable().optional(),
    slug: z.string().min(1).max(100).trim().optional(),
    icon: z
        .object({
            url: z.string().url(),
            publicId: z.string().trim().optional(),
        })
        .nullable()
        .optional(),
    settings: z
        .object({
            isPublic: z.boolean().optional(),
            allowInvites: z.boolean().optional(),
            verificationLevel: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).optional(),
            isDeleted: z.boolean().optional(),
        })
        .optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]).optional(),
});

export type CreateServerInput = z.infer<typeof createServerSchema>;
export type UpdateServerInput = z.infer<typeof updateServerSchema>;