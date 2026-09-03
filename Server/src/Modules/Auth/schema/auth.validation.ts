import { z } from "zod";

export const registerSchema = z.object({
    username: z
        .string()
        .min(2, "Username must be at least 2 characters")
        .max(32)
        .regex(/^[a-zA-Z0-9._]+$/, "Only letters, numbers, . and _ allowed")
        .trim()
        .toLowerCase(),
    email: z.string().email().trim().toLowerCase(),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    displayName: z.string().min(1).max(32).trim().optional(),
});

export const loginSchema = z
    .object({
        // Nexus allows login with either email or username (Discord-style)
        // Accept `identifier` (preferred), but also accept `email` / `username` for backwards compat
        // with clients that send { email, password } or { username, password }
        identifier: z.string().trim().optional(),
        email: z.string().trim().optional(),
        username: z.string().trim().optional(),
        password: z.string().min(1),
    })
    .transform((data) => ({
        identifier: (data.identifier?.trim() || data.email?.trim() || data.username?.trim() || "").trim(),
        password: data.password,
    }))
    .pipe(
        z.object({
            identifier: z.string().min(2, "identifier is required"),
            password: z.string().min(1),
        }),
    );

export const refreshSchema = z.object({
    refreshToken: z.string().min(1).optional(), // allow from cookie too
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
