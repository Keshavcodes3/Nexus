import mongoose from "mongoose";
import { env } from "../../config/env.js";

export async function connectDatabase(): Promise<void> {
    try {
        await mongoose.connect(env.MONGO_URI);

        console.log("🟢 MongoDB connected");
    } catch (error) {
        console.error("🔴 MongoDB connection failed", error);
        process.exit(1);
    }
}