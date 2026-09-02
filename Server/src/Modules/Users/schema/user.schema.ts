import mongoose, { Document, Schema, Types } from "mongoose";

export type UserStatus =
    | "online"
    | "idle"
    | "dnd"
    | "offline"
    | "invisible";

export interface UserDocument extends Document {
    _id: Types.ObjectId;
    username: string;
    email: string;
    displayName: string;
    passwordHash: string;
    avatarUrl?: string;
    bannerUrl?: string;
    bio?: string;
    status: UserStatus;
    customStatus?: string;
    isVerified: boolean;
    isBot: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            minlength: 2,
            maxlength: 32,
            match: /^[a-z0-9._]+$/,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        displayName: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 32,
        },
        passwordHash: {
            type: String,
            required: true,
            select: false,
        },
        avatarUrl: {
            type: String,
            default: null,
        },
        bannerUrl: {
            type: String,
            default: null,
        },
        bio: {
            type: String,
            maxlength: 190,
            default: "",
        },
        status: {
            type: String,
            enum: ["online", "idle", "dnd", "offline", "invisible"],
            default: "offline",
        },
        customStatus: {
            type: String,
            maxlength: 128,
            default: null,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        isBot: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform(_doc, ret) {
                const r = ret as Record<string, unknown>;
                delete r["passwordHash"];
                delete r["__v"];
                return r;
            },
        },
        toObject: {
            virtuals: true,
            transform(_doc, ret) {
                const r = ret as Record<string, unknown>;
                delete r["passwordHash"];
                delete r["__v"];
                return r;
            },
        },
    },
);

// Text index for search (username + displayName) - Discord-like user search
userSchema.index({ username: "text", displayName: "text" });

export const UserModel = mongoose.model<UserDocument>("User", userSchema);
