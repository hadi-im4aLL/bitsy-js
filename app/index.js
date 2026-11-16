/**
 * Application entry point: starts view rendering and exposes the running
 * instance as `window.Roolith` for the host page and its scripts.
 */
import { Roolith } from "./roolith.js";

const roolith = new Roolith();
roolith.run();

window.Roolith = roolith;
