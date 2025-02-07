import { z } from "zod";

// Sub-schemas
export const ImageModelEnum = z.enum([
    "flux_schnell",
    "flux_pro",
    "recraft",
    "flux_lora",
    "sdxl",
    "sdxl_lora",
]);

export const RecraftStyleEnum = z.enum([
    "any",
    "realistic_image",
    "digital_illustration",
    "realistic_image/b_and_w",
    "realistic_image/hard_flash",
    "realistic_image/hdr",
    "realistic_image/natural_light",
    "realistic_image/studio_portrait",
    "realistic_image/enterprise",
    "realistic_image/motion_blur",
    "digital_illustration/pixel_art",
    "digital_illustration/hand_drawn",
    "digital_illustration/grain",
    "digital_illustration/infantile_sketch",
    "digital_illustration/2d_art_poster",
    "digital_illustration/handmade_3d",
    "digital_illustration/hand_drawn_outline",
    "digital_illustration/engraving_color",
    "digital_illustration/2d_art_poster_2",
]);

export const LoraSlugEnum = z.enum([
    "ghibsky-comic-book",
    "colour-sketches",
    "sketch-paint",
    "90s-anime",
    "2000s-crime-thrillers",
    "xno-symbol-flux",
]);

export const ScriptStyleEnum = z.enum([
    "default",
    "no_style",
    "engaging_conversational",
    "dixit_biography",
    "kind_biography",
    "hero_journey",
    "emotional_story",
    "dramatic_reveal",
    "heartwarming_stories",
    "educational_history",
    "news_brief",
]);

export const CaptionsStyleEnum = z.enum([
    "default",
    "minimal",
    "neon",
    "cinematic",
    "fancy",
    "tiktok",
    "highlight",
    "gradient",
    "instagram",
    "vida",
    "manuscripts",
]);

export const TransitionEffectEnum = z.enum([
    "none",
    "fade",
    "slide",
    "wipe",
    "flip",
]);

export type TransitionEffectEnum = z.infer<typeof TransitionEffectEnum>;

export const MusicSlugEnum = z.enum([
    "",
    "temple_of_treasures",
    "gentle_ambient_loop",
    "serene_ambience",
    "soothing_ambience",
    "soothing_ambient_backdrop",
    "tranquil_ambience",
    "dreamscape",
    "belonging_resonance",
    "vivid_memories",
    "cinematic_intro",
    "cinematic_teaser",
    "dramatic_cinematic_score",
    "thriller_cinema_trailer",
    "fractured_paintings",
    "promise_of_tomorrow",
    "spooky_orchestral_theme",
    "light_upbeat_melody",
    "puzzle_time",
    "stomping_drums_rhythm",
    "stomps_and_claps_rhythm_track",
    "news_theme",
    "adventurous_intro",
    "burlesque_sweetheart",
    "highway_nocturne_national_sweetheart",
    "haptic_sensation",
]);

// API Response Schemas
export const PollingStatusEnum = z.enum([
    "WAITING_FOR_DEPLOY",
    "QUEUED",
    "EXECUTING",
    "REATTEMPTING",
    "FROZEN",
    "COMPLETED",
    "CANCELED",
    "FAILED",
    "CRASHED",
    "INTERRUPTED",
    "SYSTEM_FAILURE",
    "TIMED_OUT",
    "DELAYED",
    "EXPIRED",
]);

export const VideoOutputSchema = z
    .object({
        url: z.string(),
        size: z.number().int(),
    })
    .nullable();

export const ErrorDetailsSchema = z.record(z.unknown());

export const PollingErrorSchema = z
    .object({
        message: z.string(),
        details: ErrorDetailsSchema,
    })
    .nullable();

export const PollingResponseSchema = z.object({
    status: PollingStatusEnum,
    isCompleted: z.boolean(),
    isSuccess: z.boolean(),
    output: VideoOutputSchema,
    error: PollingErrorSchema,
});

export const VideoCreationResponseSchema = z.object({
    data: z.object({
        id: z.string(),
    }),
    requestId: z.string(),
});

export type VideoCreationResponse = z.infer<typeof VideoCreationResponseSchema>;

export const VideoGenerationErrorSchema = z.object({
    code: z.string(),
    message: z.string(),
    details: ErrorDetailsSchema.optional(),
    requestId: z.string().optional(),
});

export type VideoGenerationErrorType = z.infer<
    typeof VideoGenerationErrorSchema
>;

// Main Video Request Schema
export const VideoRequestSchema = z
    .object({
        prompt: z.string().optional(),
        script: z.string().optional(),
        scriptConfig: z
            .object({
                style: ScriptStyleEnum.default("default"),
                targetLengthInWords: z.number().min(1).max(200).default(70),
            })
            .optional(),
        directorNotes: z.string().optional(),
        shortRequestEnhancer: z.boolean().default(false),
        imageConfig: z
            .object({
                model: ImageModelEnum.default("flux_schnell"),
                recraftStyle: RecraftStyleEnum.optional(),
                loraConfig: z
                    .object({
                        loraSlug: LoraSlugEnum,
                    })
                    .optional(),
            })
            .optional(),
        voiceoverConfig: z
            .object({
                enabled: z.boolean().default(true),
                voiceId: z.string().default("zWDA589rUKXuLnPRDtAG"),
            })
            .optional(),
        captionsConfig: z
            .object({
                captionsEnabled: z.boolean().default(true),
                captionsStyle: CaptionsStyleEnum.default("default"),
                captionsPosition: z
                    .enum(["top", "center", "bottom"])
                    .default("bottom"),
            })
            .optional(),
        effectsConfig: z
            .object({
                transition: TransitionEffectEnum.default("fade"),
                floating: z.boolean().default(true),
            })
            .optional(),
        musicConfig: z
            .object({
                enabled: z.boolean().default(false),
                musicSlug: MusicSlugEnum.default(""),
                volume: z.number().min(0).max(1).default(0.3),
                loop: z.boolean().default(true),
            })
            .optional(),
        motionConfig: z
            .object({
                enabled: z.boolean().default(false),
                strength: z.number().min(1).max(10).default(3),
            })
            .optional(),
        templateConfig: z
            .object({
                templateId: z
                    .enum(["none", "longstories", "darksun"])
                    .default("darksun"),
            })
            .optional(),
        quality: z.enum(["high", "medium", "low"]).default("medium"),
    })
    .refine((data) => data.prompt !== undefined || data.script !== undefined, {
        message: "Either prompt or script must be provided",
    });

// Type exports
export type VideoRequestSchemaType = z.infer<typeof VideoRequestSchema>;
export type PollingResponseType = z.infer<typeof PollingResponseSchema>;

// Type guards using Zod
export const isVideoGenerationError = (
    response: unknown
): response is VideoGenerationError => {
    return VideoGenerationErrorSchema.safeParse(response).success;
};

export const isPollingResponse = (
    response: unknown
): response is PollingResponseType => {
    return PollingResponseSchema.safeParse(response).success;
};

export class VideoPollingError extends Error {
    code: VideoPollingErrorCode;
    details?: Record<string, unknown>;
    timestamp: Date;
    pollCount?: number;

    constructor({
        code,
        message,
        details,
        pollCount,
    }: {
        code: VideoPollingErrorCode;
        message: string;
        details?: Record<string, unknown>;
        pollCount?: number;
    }) {
        super(message);
        this.name = "VideoPollingError";
        this.code = code;
        this.details = details;
        this.timestamp = new Date();
        this.pollCount = pollCount;

        Object.setPrototypeOf(this, VideoPollingError.prototype);
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            details: this.details,
            timestamp: this.timestamp,
            pollCount: this.pollCount,
        };
    }
}

export const VideoPollingErrorCodes = {
    NETWORK_ERROR: "POLLING_NETWORK_ERROR",
    INVALID_RESPONSE: "POLLING_INVALID_RESPONSE",
    TIMEOUT: "POLLING_TIMEOUT",
    MAX_RETRIES_EXCEEDED: "POLLING_MAX_RETRIES_EXCEEDED",
    SERVICE_ERROR: "POLLING_SERVICE_ERROR",
    UNEXPECTED_STATUS: "POLLING_UNEXPECTED_STATUS",
} as const;

export type VideoPollingErrorCode =
    (typeof VideoPollingErrorCodes)[keyof typeof VideoPollingErrorCodes];

export class VideoGenerationError extends Error {
    code: string;
    details?: Record<string, unknown>;
    requestId?: string;

    constructor({
        code,
        message,
        details,
        requestId,
    }: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
        requestId?: string;
    }) {
        super(message);
        this.code = code;
        this.details = details;
        this.requestId = requestId;
    }
}
