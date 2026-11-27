import { BitsyJS } from "./lib/bitsy.js";

const bitsy = new BitsyJS({
    data: {
        appName: `Bitsy JS`,
        games: [
            { name: "PUBG", rating: 10 },
            { name: "GTA 6", rating: 7 },
            { name: "Wardogs", rating: 5 },
        ],
        aiProviders: [
            { label: "DeepSeek", cost: "low" },
            { label: "Anthropic", cost: "high" },
            { label: "OpenAI", cost: "medium" },
        ],
        page: {
            home: {
                content: "Home page content",
                text: "This is a sample text",
            },
        },
        isDebugMode: true,
    },
});

bitsy.run();

export const bjs = bitsy;
