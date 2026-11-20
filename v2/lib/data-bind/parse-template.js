export function parseTemplate(template, data) {
    return template.replace(/\{([\w\\.]*)\}/g, (str, key) => {
        const keys = key.split('.');
        let v = data[keys.shift()];

        if (keys.length > 0) {
            keys.forEach((k) => {
                v = v ? v[k] : `{${key}}`;
            });
        }

        return typeof v !== 'undefined' && v !== null ? v : str;
    });
}
