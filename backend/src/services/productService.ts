import { Product } from '../types/Product';

const products : Product[] = [
    { id: 1, name: "Arroz 5kg", price: 10.99 },
    { id: 2, name: "Feijão Preto 1kg", price: 20.99 },
    { id: 3, name: "Farinha", price: 5.49 },
];

export function findAllProducts(): Product[] {
    return products;
}

export function findProductById(id: number): Product | undefined {
    return products.find((product) => product.id === id);
}

export function createNewProduct(name: string, price: number): Product {
    const newProduct: Product = {
        id: products.length + 1,
        name,
        price,
    };

products.push(newProduct);
    return newProduct;
}

export function updateExistingProduct(
    id: number,
    name: string,
    price: number
): Product | undefined {
    const product = products.find((product) => product.id === id);

    if (!product) {
        return undefined;
    }

    product.name = name;
    product.price = price;

    return product;
}

export function deleteExistingProduct(id: number): Product | undefined {
    const productIndex = products.findIndex((product) => product.id === id);

    if (productIndex === -1) {
        return undefined;
    }

    const deletedProduct = products.splice(productIndex, 1)[0];
    return deletedProduct;
}