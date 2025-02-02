import type { Plugin } from "@elizaos/core";
import { generateShortAction } from "./actions/generateShort";

export const longstoriesPlugin: Plugin = {
    name: "longstories",
    description: "Generate short form video content",
    actions: [generateShortAction],
    clients: [],
    providers: [],
};
