import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { errorMiddleware } from "./Middlewares/errorMiddleware.js";
import authRoutes from "./Modules/Auth/routes/auth.routes.js";
import userRoutes from "./Modules/Users/routes/user.routes.js";

export function createApp() {
    const app = express();

    app.use(helmet());
    app.use(
        cors({
            origin: true,
            credentials: true,
        }),
    );
    app.use(compression());
    app.use(express.json({ limit: "1mb" }));
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(pinoHttp({ logger }));

    app.get("/health", (_req, res) => {
        res.json({ success: true, message: "Nexus API running", timestamp: new Date().toISOString() });
    });

    // Modules
    app.use("/api/auth", authRoutes);
    app.use("/api/users", userRoutes);

    // 404
    app.use((_req, res) => {
        res.status(404).json({
            success: false,
            error: { code: "NOT_FOUND", message: "Route not found" },
        });
    });

    app.use(errorMiddleware);

    return app;
}
