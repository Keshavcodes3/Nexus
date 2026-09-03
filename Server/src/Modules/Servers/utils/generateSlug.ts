import { createHash } from "node:crypto";

export function generateSlug(title: string): string {
    const words = title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .trim()
        .split(/\s+/);

    const prefix = words
        .filter((_, i) => i < 3)
        .map(word => word[0])
        .join("");

    const hash = createHash("sha256")
        .update(title)
        .digest("hex")
        .slice(0, 6);

    return `${prefix}-${hash}`;
}