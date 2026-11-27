const effectStack = [];

export function isSignal(value) {
    return typeof value === "function" && value.__isSignal === true;
}

function cleanupEffect(runner) {
    for (const subscribers of runner.deps) {
        subscribers.delete(runner);
    }
    runner.deps.clear();
}

export function signal(initialValue) {
    let value = initialValue;
    const subscribers = new Set();

    const notifySubscribers = () => {
        for (const subscriber of Array.from(subscribers)) {
            subscriber(value);
        }
    };

    const read = () => {
        const activeEffect = effectStack[effectStack.length - 1];
        if (activeEffect) {
            subscribers.add(activeEffect);
            activeEffect.deps.add(subscribers);
        }

        return value;
    };

    read.__isSignal = true;

    read.peek = () => value;

    read.set = (newValue) => {
        if (Object.is(value, newValue)) {
            return value;
        }

        value = newValue;
        notifySubscribers();

        return value;
    };

    read.update = (callback) => {
        return read.set(callback(value));
    };

    read.subscribe = (callback) => {
        subscribers.add(callback);

        return {
            unsubscribe: () => {
                subscribers.delete(callback);
            },
        };
    };

    return read;
}

export function effect(callback) {
    const runner = () => {
        cleanupEffect(runner);
        effectStack.push(runner);
        try {
            callback();
        } finally {
            effectStack.pop();
        }
    };

    runner.deps = new Set();
    runner();

    return () => {
        cleanupEffect(runner);
    };
}

export function computed(callback) {
    const derived = signal(undefined);

    const dispose = effect(() => {
        derived.set(callback());
    });

    const read = () => derived();
    read.__isSignal = true;
    read.peek = () => derived.peek();
    read.subscribe = (fn) => derived.subscribe(fn);
    read.dispose = dispose;

    return read;
}
