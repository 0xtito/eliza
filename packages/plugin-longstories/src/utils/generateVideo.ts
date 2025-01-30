import { elizaLogger } from "@elizaos/core";
import { getEnvVariable } from "../../../core/src/settings.ts";
import {
    TransitionEffectEnum,
    VideoRequestSchema,
    VideoRequestSchemaType,
    VideoGenerationResponse,
    VideoGenerationError,
} from "../types.ts";

interface CreateVideoParams {
    effects: {
        transition: TransitionEffectEnum;
        floating: boolean;
    };
    motionEnabled?: boolean;
    quality?: "low" | "medium" | "high";
}

export async function createVideo(
    prompt: string,
    params: CreateVideoParams
): Promise<VideoGenerationResponse | VideoGenerationError> {
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
        voiceoverConfig: {
            enabled: true,
            voiceId: "YYHkBdgrAwQWIaH6m2ai",
        },
        captionsConfig: {
            captionsEnabled: true,
            captionsPosition: "bottom",
            captionsStyle: "manuscripts",
        },
        directorNotes: ``,
    } as VideoRequestSchemaType);

    try {
        const videoServiceUrl = getEnvVariable("VIDEO_SERVICE_URL");
        const videoServiceApiKey = getEnvVariable("VIDEO_SERVICE_API_KEY");

        if (!videoServiceUrl || !videoServiceApiKey) {
            throw new VideoGenerationError({
                code: "VIDEO_SERVICE_ERROR",
                message: "Video service URL or API key is not set",
            });
        }

        // Your existing video generation code here
        const response = await fetch(`${videoServiceUrl}/api/v1/short`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": videoServiceApiKey,
            },
            body: JSON.stringify(videoParams),
        });

        console.log("response", response);

        const successData = (await response.json()) as VideoGenerationResponse;

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
