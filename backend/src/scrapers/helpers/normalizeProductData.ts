// Normaliza nomes, embalagens e preços e verifica se uma oferta corresponde ao produto.
export function cleanText(value: string | null): string {
    return value?.replace(/\s+/g, ' ').trim() || '';
}
export function parsePrice(value: string | null): number {
    const text = cleanText(value).replace(/€/g, '').replace(/\s/g, '');
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{2})?$/.test(text)) throw new Error('Preço ausente ou formato não reconhecido.');
    const price = Number(text.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(price) || price <= 0) throw new Error('Preço inválido.');
    return price;
}
export function normalizeText(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/espaguete|spaghetti/g, 'esparguete').replace(/macarrao/g, 'massa')
        .replace(/\b(?:tipo\s*|t\s*)(55|65)\b/g, 't$1');
}
export function packageQuantity(text: string): string | null {
    const normalized = normalizeText(text.split('|')[0]).replace(/\bgr\b/g, 'g').replace(/\blt\b/g, 'l');
    // Multi-packs need an explicit equivalence rule; never silently treat them as a single pack.
    if (/\d\s*[x×]\s*\d/.test(normalized)) return null;
    if (/[+%]/.test(normalized)) return null;
    const matches = [...normalized.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/g)];
    if (matches.length !== 1) return null;
    const [, amount, unit] = matches[0];
    const factor: Record<string, number> = { kg: 1000, g: 1, l: 1000, cl: 10, ml: 1 };
    return `${Math.round(Number(amount.replace(',', '.')) * factor[unit])}${['kg','g'].includes(unit) ? 'g' : 'ml'}`;
}
export function matchesProduct(search: string, name: string, quantity: string): boolean {
    const requiredQuantity = packageQuantity(search);
    const actualQuantity = packageQuantity(quantity);
    if (!actualQuantity || (requiredQuantity && actualQuantity !== requiredQuantity)) return false;
    const words = normalizeText(search).replace(/\d+(?:[.,]\d+)?\s*(kg|g|ml|cl|l)\b/g, '').split(/[^a-z0-9]+/).filter(w => w && !['de','do','da'].includes(w));
    const found = normalizeText(name).split(/[^a-z0-9]+/);
    const requested = normalizeText(search), offered = normalizeText(name);
    const variants = [/\bintegral\b/, /\bsem lactose\b/, /\bsem gluten\b/, /\btricolor\b/, /\bdi nero\b/, /\bbiologico\b/, /\bbio\b/, /\bmagra\b/, /\blight\b/, /\bvegetal\b/];
    if (variants.some(variant => variant.test(offered) && !variant.test(requested))) return false;
    if (/\bfeijao\b/.test(requested) && /\bcozido\b|\bescorrido\b/.test(offered + ' ' + normalizeText(quantity))) return false;
    if (/\bsal fino\b/.test(requested) && /\brosa\b|\bhimalaias\b|\biodado\b|\bsodio\b/.test(offered)) return false;
    // Dietary variants must be explicitly requested, not selected only for a lower price.
    if (/\bleite\b/.test(normalizeText(search)) && /\bsem lactose\b/.test(normalizeText(name)) && !/\bsem lactose\b/.test(normalizeText(search))) return false;
    if (/\bfarinha\b/.test(normalizeText(search)) && /\bintegral\b/.test(normalizeText(name)) && !/\bintegral\b/.test(normalizeText(search))) return false;
    return words.every(word => found.includes(word));
}
