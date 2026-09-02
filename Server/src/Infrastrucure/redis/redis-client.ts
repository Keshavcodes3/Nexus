import { Redis } from "ioredis";
import { env } from "../../config/env.js";

export const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
});

redis.on("connect", () => {
    console.log("🔌 Redis connecting...");
});

redis.on("ready", () => {
    console.log("🟢 Redis ready");
});

redis.on("error", (error: Error) => {
    console.error("🔴 Redis error:", error);
});

redis.on("close", () => {
    console.log("🟡 Redis connection closed");
});