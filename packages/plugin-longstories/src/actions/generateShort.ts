import {
    type Action,
    type IAgentRuntime,
    type State,
    type Memory,
    elizaLogger,
    type HandlerCallback,
    type Content,
    generateText,
    ModelClass,
} from "@elizaos/core";
import { validateLongStoriesConfig } from "../environment";
import { createVideo, pollVideoStatus } from "../utils/generateVideo";
import { VideoGenerationError, VideoGenerationErrorType } from "../types";

const shortGenerationTemplate = `
You are a video generation agent.

You will be given a request from a user, take that request and create a prompt to be used to create a short form video.

[Instructions]
1. The prompt should be no more than 50 words
2. Be creative and think about what would be the best way to represent the request in a video
3. The prompt should be one to two sentences that captures the main idea of the video
4. Respond only with the prompt, nothing else. Do not include any other text or comments.
`;

export const generateShortAction: Action = {
    name: "Generate Short",
    description: "Generate a short video story",
    similes: ["CreateShort", "MakeShort", "ShortGeneration"],
    validate: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _state?: State
    ) => {
        const config = await validateLongStoriesConfig(runtime);

        if (!config.LONG_STORIES_API_KEY) {
            elizaLogger.error("Long Stories API key is not set");
            return false;
        }
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback
    ) => {
        try {
            const config = await validateLongStoriesConfig(runtime);

            const videoPrompt = await generateText({
                runtime,
                customSystemPrompt: shortGenerationTemplate,
                modelClass: ModelClass.MEDIUM,
                context: message.content.text,
            });

            elizaLogger.info("Generating short video", {
                userMessage: message.content.text,
                prompt: videoPrompt,
            });

            const generationResponse = await createVideo(runtime, videoPrompt, {
                effects: {
                    transition: "fade",
                    floating: true,
                },
                motionEnabled: config.LONG_STORIES_WITH_MOTION,
                quality: "medium",
            });

            if (generationResponse instanceof VideoGenerationError) {
                throw generationResponse;
            }

            if (!generationResponse) {
                throw new VideoGenerationError({
                    code: "MISSING_RUN_ID",
                    message: "Video generation failed to start",
                });
            }

            const videoGeneratingContent: Content = {
                text: "Generating video...",
            };

            elizaLogger.info("Video generation started", {
                runId: generationResponse.data.id,
            });

            callback?.(videoGeneratingContent, {
                videoId: generationResponse.data.id,
            });

            const videoUrl = await pollVideoStatus(
                runtime,
                generationResponse.data.id
            );

            elizaLogger.info("Video generation completed", {
                runId: generationResponse.data.id,
                videoUrl,
            });

            const videoGeneratedContent: Content = {
                text: `Video generated successfully: ${videoUrl}`,
            };

            callback?.(videoGeneratedContent, {
                videoUrl,
            });

            return {
                success: true,
                videoUrl,
                runId: generationResponse.data.id,
            };
        } catch (error) {
            if (error instanceof VideoGenerationError) {
                elizaLogger.error("Video generation failed", error.message);
                return {
                    success: false,
                    error: error.message,
                    code: error.code,
                };
            }

            elizaLogger.error(
                "Unexpected error in generateShort",
                error.message
            );
            return {
                success: false,
                error: "Unexpected error occurred",
            };
        }
    },

    examples: [],
};
