/**
 * Handles returned by signal subscriptions.
 */
export interface SignalSubscription {
    unsubscribe(): void;
}

/**
 * Reactive value returned by `signal()`.
 */
export interface Signal<T> {
    (): T;
    readonly __isSignal: true;
    peek(): T;
    set(value: T): T;
    update(updater: (current: T) => T): T;
    subscribe(callback: (value: T) => void): SignalSubscription;
}

/**
 * Derived reactive value returned by `computed()`.
 */
export interface Computed<T> {
    (): T;
    readonly __isSignal: true;
    peek(): T;
    subscribe(callback: (value: T) => void): SignalSubscription;
    dispose(): void;
}

/**
 * Directive tag and attribute names used by BitsyJS.
 */
export interface BitsyTags {
    dataBind: string;
    forLoop: string;
    view: string;
    container: string;
    conditionIf: string;
    rawJs: string;
    on: string;
    event: string;
    remoteData: string;
    useTemplate: string;
    keepExisting: string;
    validateForm: string;
    validateRule: string;
    validateMessage: string;
    validateErrorMessage: string;
    formAjax: string;
    formAjaxRender: string;
    formRemoveOnSubmit: string;
    formIndicator: string;
    formConfirm: string;
}

/**
 * Validation message keys that can be overridden with `validatorConfig.messages`.
 */
export type BitsyValidationMessage =
    | "required"
    | "email"
    | "min"
    | "max"
    | "number"
    | "bool"
    | "same"
    | "url"
    | "date"
    | "jsDate"
    | "datetime"
    | "time"
    | "pattern"
    | "length"
    | "int"
    | "float";

/**
 * Validation class names and messages.
 */
export interface BitsyValidatorConfig {
    classNames?: {
        error?: string;
        success?: string;
    };
    messages?: Partial<Record<BitsyValidationMessage, string>>;
    addClassToParent?: boolean;
    addClassToField?: boolean;
}

/**
 * Constructor options accepted by `BitsyJS`.
 */
export interface BitsySettings {
    tags?: Partial<BitsyTags>;
    data?: Record<string, unknown>;
    validatorConfig?: BitsyValidatorConfig;
}

/**
 * Default configuration exposed as `bitsy.config`.
 */
export interface BitsyConfig {
    tags: BitsyTags;
    data: Record<string, unknown>;
    validatorConfig: BitsyValidatorConfig;
}

/**
 * Fully resolved settings exposed as `bitsy.settings`.
 */
export interface BitsyResolvedSettings extends Omit<BitsySettings, "tags" | "data" | "validatorConfig"> {
    tags: BitsyTags;
    data: Record<string, unknown>;
    validatorConfig: BitsyValidatorConfig;
}

/**
 * Adds declarative data binding, directives, events and validation to existing HTML.
 */
export declare class BitsyJS {
    constructor(settings?: BitsySettings);
    config: BitsyConfig;
    settings: BitsyResolvedSettings;
    run(): Promise<void>;
    on(eventName: string, callback: (value?: unknown) => void): this;
    ready(callback: () => void): void;
}

/**
 * Creates a writable reactive value.
 */
export declare function signal<T>(initialValue: T): Signal<T>;

/**
 * Creates a read-only value derived from other signals.
 */
export declare function computed<T>(callback: () => T): Computed<T>;

/**
 * Runs a side effect immediately and again when the signals it reads change.
 * Returns a function that stops the effect.
 */
export declare function effect(callback: () => void): () => void;

/**
 * Returns true when a value is a signal or computed value.
 */
export declare function isSignal(value: unknown): value is Signal<unknown> | Computed<unknown>;
