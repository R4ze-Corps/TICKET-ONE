import { validateEnv } from "@constatic/base";
import { z } from "zod";
import "./constants.js";
export const env = await validateEnv(z.looseObject({
    BOT_TOKEN: z.string("Discord Bot Token is required").min(1),
    WEBHOOK_LOGS_URL: z.url().optional(),
    GUILD_ID: z.string().optional(),
    MONGO_URI: z.string().optional(),
    MONGODB_URI: z.string().optional(),
    DATABASE_NAME: z.string().optional(),
    BOT_API_SECRET: z.string().optional(),
    WEB_URL: z.string().url().default("http://localhost:3000"),
}));
