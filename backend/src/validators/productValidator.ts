export interface ProductValidationErrors {
    name?: string;
    price?: string;
}

export function validateProductData(
    name: unknown,
    price: unknown
): ProductValidationErrors {
    const errors: ProductValidationErrors = {};

    if (!name || typeof name !== 'string') {
        errors.name = 'Nome do produto é obrigatório e deve ser uma string';
    }

    if (typeof price !== 'number' || price <= 0) {
        errors.price = 'Preço do produto é obrigatório e deve ser um número maior que zero';
    }

    return errors;
}