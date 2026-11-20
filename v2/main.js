import { Roolith } from "./lib/roolith.js";

const roolith = new Roolith({
    data: {
        appName: `Roolith JS`,
        games: [
            { name: "PUBG", rating: 10 },
            { name: "GTA 6", rating: 7 },
            { name: "Wardogs", rating: 5 }
        ]
    }
});
roolith.run();
