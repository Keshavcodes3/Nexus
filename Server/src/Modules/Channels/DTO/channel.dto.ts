import { Types } from "mongoose";
import { z } from "zod";
import {
    ChannelStatus,
    ChannelType,
    type IChannel,
} from "../Schema/channel.schema.js";

// Re-export enums so DTO layer stays in sync with schema
export { ChannelStatus, ChannelType };

export interface CreateChannelDTO {
    name: string;
    nameNormalized?: string | undefined;
    slug: string;
    description?: string | undefined;
    serverId: Types.ObjectId;
    ownerId: Types.ObjectId;
    type?: ChannelType | undefined;
    status?: ChannelStatus | undefined;
    position?: number | undefined;
    memberCount?: number | undefined;
}

export interface CreateChannelInputDTO {
    name: string;
    slug?: string | undefined;
    description?: string | undefined;
    type?: ChannelType | undefined;
    position?: number | undefined;
}

export interface UpdateChannelDTO {
    name?: string | undefined;
    nameNormalized?: string | undefined;
    slug?: string | undefined;
    description?: string | null | undefined;
    type?: ChannelType | undefined;
    status?: ChannelStatus | undefined;
    position?: number | undefined;
    memberCount?: number | undefined;
    deletedAt?: Date | null | undefined;
}

export interface ChannelResponseDTO {
    _id: string;
    id: string;
    name: string;
    nameNormalized: string;
    slug: string;
    description: string | null;
    serverId: string;
    ownerId: string;
    type: ChannelType;
    status: ChannelStatus;
    position: number;
    memberCount: number;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export function toChannelResponseDTO(
    doc: IChannel & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date },
): ChannelResponseDTO {
    const idStr = doc._id.toString();
    return {
        _id: idStr,
        id: idStr,
        name: doc.name,
        nameNormalized: doc.nameNormalized,
        slug: doc.slug,
        description: doc.description ?? null,
        serverId: doc.serverId.toString(),
        ownerId: doc.ownerId.toString(),
        type: doc.type,
        status: doc.status,
        position: doc.position,
        memberCount: doc.memberCount,
        deletedAt: doc.deletedAt ?? null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

// Zod schemas - single source of truth for validation
export const createChannelSchema = z.object({
    name: z.string().min(1, "Name is required").max(100).trim(),
    slug: z
        .string()
        .min(1)
        .max(100)
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format")
        .optional(),
    description: z.string().max(500).trim().optional(),
    type: z.enum(["TEXT", "VOICE", "ANNOUNCEMENT"]).optional(),
    position: z.number().int().min(0).optional(),
});

export const updateChannelSchema = z.object({
    name: z.string().min(1).max(100).trim().optional(),
    slug: z
        .string()
        .min(1)
        .max(100)
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format")
        .optional(),
    description: z.string().max(500).trim().nullable().optional(),
    type: z.enum(["TEXT", "VOICE", "ANNOUNCEMENT"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]).optional(),
    position: z.number().int().min(0).optional(),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
