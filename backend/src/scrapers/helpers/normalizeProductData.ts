export function cleanText(value: string | null): string {
    return value?.replace(/\s+/g, " ").trim() || "";
}

export function parsePrice(value: string | null): number {
    if (!value) return 0;

    return Number(
    value
        .replace(/\s+/g, "")
        .replace("€", "")
        .replace(",", ".")
        .trim()
    );
}