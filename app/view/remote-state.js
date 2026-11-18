/**
 * Attribute that reports the state of a remote request on its element.
 *
 * Not configurable, matching `data-r-error`, because it reports library state rather than a directive.
 */
export const REMOTE_STATE_ATTRIBUTE = "data-r-remote";

/**
 * Value of {@link REMOTE_STATE_ATTRIBUTE} while the request is pending.
 */
export const REMOTE_PENDING_STATE = "loading";
