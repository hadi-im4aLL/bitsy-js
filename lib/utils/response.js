export async function parseResponse(response) {
    const type = (response.headers.get("content-type") || "").toLowerCase();

    if (type.includes("json")) {
        return await response.json();
    }

    if (type.includes("html") || type.startsWith("text/")) {
        return await response.text();
    }

    if (type.includes("image/")) {
        return await response.blob();
    }

    const text = await response.text();

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}
