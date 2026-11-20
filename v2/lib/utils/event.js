export class Event {
    static events = [];

    static listen(name, callback) {
        if (!Event.events[name]) {
            Event.events[name] = [];
        }

        Event.events[name].push(callback);
    }

    static listeners(eventNames = [], callback) {
        if (eventNames.length === 0) {
            return;
        }

        eventNames.forEach(name => {
            Event.listen(name, callback);
        });
    }

    static dispatch(name, arg) {
        if (!Event.events[name]) {
            return;
        }

        Event.events[name].forEach(callback => {
            if (arg) {
                callback.call(Event, name, arg);
            } else {
                callback.call(Event, name);
            }
        });
    }
}
