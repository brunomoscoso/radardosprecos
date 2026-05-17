export interface ProductValidationErrors {
    name?: string;
    category?: string;
    description?: string;
}

export function validateProductData(
    name: unknown,
    category?: unknown,
    description?: unknown
): ProductValidationErrors {
    const errors: ProductValidationErrors = {};

    if (!name || typeof name !== "string" || !name.trim()) {
        errors.name = "Nome do produto é obrigatório e deve ser uma string válida";
    }

    if (category !== undefined && category !== null && typeof category !== "string") {
        errors.category = "Categoria deve ser uma string";
    }

    if (
        description !== undefined &&
        description !== null &&
        typeof description !== "string"
    ) {
        errors.description = "Descrição deve ser uma string";
    }

    return errors;
}