import { env } from "./config/env.js";
import { connectDatabase } from "./Infrastrucure/Database/database.js";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";

async function bootstrap(): Promise<void> {
    await connectDatabase();

    const app = createApp();

    app.listen(env.PORT, () => {
        logger.info(`🚀 Nexus server running on http://localhost:${env.PORT}`);
    });
}

void bootstrap();
