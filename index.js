/**
 * Application entry point: starts view rendering with demo data and exposes the
 * running instance as `window.Roolith` for the host page and its scripts.
 */
import { Roolith } from "./app/roolith.js";

const roolith = new Roolith({
    data: {
        appName: "Roolith JS",
        products: [
            { name: "Coffee", description: "Roasted beans" },
            { name: "Tea", description: "Green leaves" },
        ],
    },
});

roolith.run();

window.Roolith = roolith;
