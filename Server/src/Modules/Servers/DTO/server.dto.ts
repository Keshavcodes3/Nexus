import { Types } from "mongoose";
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
    id: string;
    name: string;
    slug: string;
    description?: string | null | undefined;
    icon: ServerIconDTO | null;
    ownerId: string;
    status: ServerStatus;
    settings: IServerSettings;
    memberCount: number;
    channelCount: number;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export function toServerResponseDTO(doc: IServer & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date }): ServerResponseDTO {
    return {
        id: doc._id.toString(),
        name: doc.name,
        slug: doc.slug,
        description: doc.description ?? null,
        icon: doc.icon ? { url: doc.icon.url, publicId: doc.icon.publicId } : null,
        ownerId: doc.ownerId.toString(),
        status: doc.status,
        settings: doc.settings,
        memberCount: doc.memberCount,
        channelCount: doc.channelCount,
        deletedAt: doc.deletedAt ?? null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}