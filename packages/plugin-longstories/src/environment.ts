import { parseBooleanFromText, type IAgentRuntime } from "@elizaos/core";
import { z, ZodError } from "zod";

const POLLING_INTERVAL = 5000; // 5 seconds
const MAX_POLLING_ATTEMPTS = 30; // 2.5 minutes total

const longStoriesEnvSchema = z.object({
    LONG_STORIES_API_KEY: z.string(),
    LONG_STORIES_WITH_MOTION: z.boolean().default(false),
    POLLING_INTERVAL: z.number().default(POLLING_INTERVAL),
    MAX_POLLING_ATTEMPTS: z.number().default(MAX_POLLING_ATTEMPTS),
});

export type LongStoriesConfig = z.infer<typeof longStoriesEnvSchema>;

export async function validateLongStoriesConfig(
    runtime: IAgentRuntime
): Promise<LongStoriesConfig> {
    const longStoriesConfig = {
        LONG_STORIES_API_KEY:
            runtime.getSetting("LONG_STORIES_API_KEY") ||
            process.env.LONG_STORIES_API_KEY,
        LONG_STORIES_WITH_MOTION:
            parseBooleanFromText(
                runtime.getSetting("LONG_STORIES_WITH_MOTION") ||
                    process.env.LONG_STORIES_WITH_MOTION
            ) ?? false,
        POLLING_INTERVAL: safeParseInt(
            runtime.getSetting("POLLING_INTERVAL") ||
                process.env.POLLING_INTERVAL,
            POLLING_INTERVAL
        ),
        MAX_POLLING_ATTEMPTS: safeParseInt(
            runtime.getSetting("MAX_POLLING_ATTEMPTS") ||
                process.env.MAX_POLLING_ATTEMPTS,
            MAX_POLLING_ATTEMPTS
        ),
    };

    try {
        return longStoriesEnvSchema.parse(longStoriesConfig);
    } catch (error) {
        if (error instanceof ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Long Stories configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}

function safeParseInt(
    value: string | undefined | null,
    defaultValue: number
): number {
    if (!value) return defaultValue;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : Math.max(1, parsed);
}
