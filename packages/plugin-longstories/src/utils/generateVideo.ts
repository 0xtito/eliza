import { elizaLogger, type IAgentRuntime } from "@elizaos/core";
import { getEnvVariable } from "../../../core/src/settings.ts";
import type {
    TransitionEffectEnum,
    VideoRequestSchemaType,
    VideoCreationResponse,
    VideoGenerationErrorType,
} from "../types.ts";

import {
    VideoGenerationError,
    VideoPollingError,
    VideoRequestSchema,
    PollingResponseSchema,
} from "../types.ts";
import { validateLongStoriesConfig } from "../environment.ts";

const POLLING_INTERVAL = 5000; // 5 seconds
const MAX_POLLING_ATTEMPTS = 30; // 2.5 minutes total

interface CreateVideoParams {
    effects: {
        transition: TransitionEffectEnum;
        floating: boolean;
    };
    motionEnabled?: boolean;
    quality?: "low" | "medium" | "high";
}

export async function createVideo(
    runtime: IAgentRuntime,
    prompt: string,
    params: CreateVideoParams
): Promise<VideoCreationResponse> {
    const { quality = "medium", effects, motionEnabled = false } = params;

    const videoParams: VideoRequestSchemaType = VideoRequestSchema.parse({
        prompt,
        shortRequestEnhancer: false,
        effectsConfig: effects,
        quality,
        imageConfig: {
            model: "flux_lora",
            loraConfig: {
                loraSlug: "2000s-crime-thrillers",
            },
        },
        templateConfig: {
            templateId: "none",
        },
        scriptConfig: {
            style: "no_style",
            targetLengthInWords: 55,
        },
        motionConfig: {
            enabled: motionEnabled,
            strength: 3,
        },
        voiceoverConfig: {
            enabled: true,
            voiceId: "YYHkBdgrAwQWIaH6m2ai",
        },
        captionsConfig: {
            captionsEnabled: true,
            captionsPosition: "bottom",
            captionsStyle: "manuscripts",
        },
    } as VideoRequestSchemaType);

    try {
        const videoServiceUrl = "https://longstories.ai";
        const config = await validateLongStoriesConfig(runtime);

        if (!config.LONG_STORIES_API_KEY) {
            throw new VideoGenerationError({
                code: "VIDEO_SERVICE_ERROR",
                message: "Longstories API key is not set",
            });
        }
        // Your existing video generation code here
        const response = await fetch(`${videoServiceUrl}/api/v1/short`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": config.LONG_STORIES_API_KEY,
            },
            body: JSON.stringify(videoParams),
        });

        const successData = (await response.json()) as VideoCreationResponse;

        elizaLogger.debug("Video generation success data", {
            successData,
        });

        return successData;
    } catch (error) {
        console.error("Detailed error:", {
            error,
        });

        elizaLogger.error("Video generation failed", {
            error,
            errorMessage: error.message,
        });

        throw new VideoGenerationError({
            code: "VIDEO_GENERATION_FAILED",
            message: "Video generation failed",
        });
    }
}

export async function pollVideoStatus(
    runtime: IAgentRuntime,
    runId: string
): Promise<string> {
    let attempts = 0;

    while (attempts < MAX_POLLING_ATTEMPTS) {
        attempts++;

        try {
            const videoServiceUrl = "https://longstories.ai";
            const config = await validateLongStoriesConfig(runtime);

            if (!config.LONG_STORIES_API_KEY) {
                throw new VideoGenerationError({
                    code: "VIDEO_SERVICE_ERROR",
                    message: "Longstories API key is not set",
                });
            }
            const response = await fetch(
                `${videoServiceUrl}/api/v1/short?runId=${runId}`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": config.LONG_STORIES_API_KEY,
                    },
                }
            );

            if (!response.ok) {
                throw new VideoPollingError({
                    code: "POLLING_SERVICE_ERROR",
                    message: `API responded with ${response.status}`,
                    pollCount: attempts,
                });
            }

            const rawData = await response.json();

            elizaLogger.debug("Video polling response", {
                runId,
                rawData,
            });

            const parsedResponse = PollingResponseSchema.parse(rawData.data);

            if (parsedResponse.error) {
                throw new VideoGenerationError({
                    code: "VIDEO_SERVICE_ERROR",
                    message: parsedResponse.error.message,
                    details: parsedResponse.error.details,
                });
            }

            if (parsedResponse.isCompleted) {
                if (parsedResponse.output?.url) {
                    return parsedResponse.output.url;
                }
                throw new VideoGenerationError({
                    code: "MISSING_OUTPUT_URL",
                    message: "Video generation completed but no URL found",
                });
            }

            await new Promise((resolve) =>
                setTimeout(resolve, POLLING_INTERVAL)
            );
        } catch (error) {
            if (error instanceof VideoGenerationError) throw error;

            throw new VideoPollingError({
                code: "POLLING_NETWORK_ERROR",
                message: "Failed to poll video status",
                details:
                    error instanceof Error
                        ? { error: error.message }
                        : undefined,
                pollCount: attempts,
            });
        }
    }

    throw new VideoPollingError({
        code: "POLLING_MAX_RETRIES_EXCEEDED",
        message: "Video generation timed out",
        pollCount: attempts,
    });
}
