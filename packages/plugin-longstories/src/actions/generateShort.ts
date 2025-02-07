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
    generateMessageResponse,
    composeContext,
    messageCompletionFooter,
} from "@elizaos/core";
import { validateLongStoriesConfig } from "../environment";
import { createVideo, pollVideoStatus } from "../utils/generateVideo";
import { VideoGenerationError, VideoGenerationErrorType } from "../types";

const shortGenerationTemplate = `
You are an AI that writes scripts for short videos (like YouTube Shorts or TikTok). 

When you see: [USER INPUT FOLLOWS], right after that there is what the user wrote in the box where they can request for a script. So if they say "create a story about a cat", you write a story about a cat with the given requiremets.  

[USER INPUT FOLLOWS]
{{userInput}}

FINAL NOTES: 

- THE SCRIPT MUST NOT BE MORE THAN {{LONGSTORIES_MAX_SCRIPT_LENGTH}} WORDS.

- Respond with ONLY the script text, no additional formatting, notes, or things that are not purely what the voiceover need to read.  

- BEAR IN MIND THAT What you write will be read word by word, and will become the voiceover of the video through Elevenlabs.  

- The script should be written in the predominant language of the prompt. 

- Once more, Make 100% sure to write a script that is made for voiceover delivery. 
`;

const shortGeneratedTemplate = `
Given the script, and the link to the generated video, please write a message to the user that the video has been generated successfully.

[SCRIPT]
{{script}}

[VIDEO URL]
{{videoUrl}}

[INSTRUCTIONS]
- Write a message to the user that the video has been generated successfully.
- The message should be short and to the point.
- The message should include a short summary of the video.
- Respond with ONLY the message text, no additional formatting, notes.

${messageCompletionFooter}`;

const directorNotesTemplate = `
You are an expert videographer and director who specializes in creating engaging short-form video content. Your role is to provide detailed visual direction for the given script that will be used to generate a video.

[SCRIPT]
{{script}}

Important notes:
- Keep the visual direction concise but descriptive
- Focus on creating visually engaging content optimized for vertical short-form video
- Ensure the visuals complement and enhance the voiceover script
- Consider the limitations of AI video generation
- Respond only with the visual direction, no additional commentary


[INSTRUCTIONS]
1. Provide clear and specific visual direction for this script, focusing on:
- The main visual scenes and transitions
- Camera angles and movements
- Visual effects and filters if needed
- Pacing and timing
- Any specific imagery or visuals that should accompany certain parts of the script
- The overall mood and aesthetic of the video
2. Respond only with the visual direction, no additional commentary

[RESPONSE FORMAT]
${messageCompletionFooter}`;

const errorTemplate = `
You are a helpful assistant explaining a technical error to a user in a clear and friendly way.

[ERROR MESSAGE]
{{errorMsg}}

[INSTRUCTIONS]
- Explain the error in simple, non-technical terms that any user can understand
- Provide context about what went wrong and why it might have happened
- If possible, suggest potential solutions or next steps
- Keep the tone helpful and reassuring
- Focus on clarity and actionability
- Avoid technical jargon unless necessary

Please reformulate the error message above into a clear, user-friendly explanation.
${messageCompletionFooter}
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
        state: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback
    ) => {
        try {
            const config = await validateLongStoriesConfig(runtime);

            const newState: State = {
                ...state,
                userInput: message.content.text,
                LONGSTORIES_MAX_SCRIPT_LENGTH:
                    config.LONG_STORIES_MAX_SCRIPT_LENGTH,
            };

            const context = composeContext({
                state: newState,
                template: shortGenerationTemplate,
            });

            const videoScript = await generateText({
                runtime,
                customSystemPrompt: shortGenerationTemplate,
                modelClass: ModelClass.MEDIUM,
                context,
            });

            let directorNotes: string | undefined;

            if (config.LONG_STORIES_WITH_DIRECTOR_NOTES) {
                elizaLogger.info("Generating director notes", {
                    script: videoScript,
                });
                const directorNotesResponse = await generateMessageResponse({
                    runtime,
                    context: composeContext({
                        state: {
                            ...newState,
                            script: videoScript,
                        },
                        template: directorNotesTemplate,
                    }),
                    modelClass: ModelClass.MEDIUM,
                });
                directorNotes = directorNotesResponse.text;
                elizaLogger.info("Director notes generated", {
                    directorNotes,
                });
            }

            elizaLogger.info("Generating short video", {
                userMessage: message.content.text,
                script: videoScript,
            });

            const generationResponse = await createVideo(runtime, videoScript, {
                effectsConfig: {
                    transition: "fade",
                    floating: config.LONG_STORIES_WITH_MOTION,
                },
                motionConfig: {
                    enabled: config.LONG_STORIES_WITH_VIDEO_MOTION,
                    strength: 3,
                },
                quality: "medium",
                directorNotes,
            });

            const videoGeneratingContent: Content = {
                text: "Generating video...",
            };

            callback?.(videoGeneratingContent, {
                videoId: generationResponse.data.id,
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

            const messageContext = composeContext({
                state: {
                    ...newState,
                    videoUrl,
                },
                template: shortGeneratedTemplate,
            });

            const messageResponse = await generateMessageResponse({
                runtime,
                context: messageContext,
                modelClass: ModelClass.MEDIUM,
            });

            messageResponse.text = messageResponse.text.concat(
                `\n\nVideo URL: ${videoUrl}`
            );

            callback?.(messageResponse, {
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

            const errorContext = composeContext({
                state: {
                    ...state,
                    errorMsg: error.message,
                },
                template: errorTemplate,
            });

            const errorResponse = await generateMessageResponse({
                runtime,
                context: errorContext,
                modelClass: ModelClass.MEDIUM,
            });

            callback?.(errorResponse, {
                videoUrl: "",
                runId: "",
            });

            return {
                success: false,
                error: "Unexpected error occurred",
            };
        }
    },

    examples: [],
};
