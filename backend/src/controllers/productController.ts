import { Request, Response } from "express";
import { 
    findAllProducts, 
    findProductById,
    createNewProduct,
    updateExistingProduct,
    deleteExistingProduct
} from '../services/productService';


export function getProducts(req: Request, res: Response): void {
    const products = findAllProducts();
    res.status(200).json(products);
}

export function getProductById(req: Request, res: Response): void {
    const id = Number(req.params.id);
    const product = findProductById(id);

    if(!product){
        res.status(404).json({ message: "Produto não encontrado" });
        return;
    }
    res.status(200).json(product);     
}

export function createProduct(req: Request, res: Response): void {
    const { name, price } = req.body;

    if(!name || typeof name !== "string"){
        res.status(400).json({ message: "Nome do produto é obrigatório e deve ser uma string" });
        return;
    }
    if(!price || typeof price !== "number"){
        res.status(400).json({ message: "Preço do produto é obrigatório e deve ser um número" });
        return;
    }

    const newProduct = createNewProduct(name, price);

    res.status(201).json(newProduct);
}

export function updateProduct(req: Request, res: Response): void {
    const id = Number(req.params.id);
    const { name, price } = req.body;

if (!name || typeof name !== 'string') {
    res.status(400).json({ message: 'O campo name é obrigatório e deve ser texto' });
    return;
}

if (typeof price !== 'number' || price <= 0) {
    res.status(400).json({ message: 'O campo price deve ser um número maior que zero' });
    return;
}

const updatedProduct = updateExistingProduct(id, name, price);

if (!updatedProduct) {
    res.status(404).json({ message: "Produto não encontrado" });
    return;
}

res.status(200).json(updatedProduct);
}

export function deleteProduct(req: Request, res: Response): void {
    const id = Number(req.params.id);

    const deletedProduct = deleteExistingProduct(id);

    if (!deletedProduct) {
        res.status(404).json({ message: "Produto não encontrado" });
    return;
    }

    res.status(200).json({
        message: 'Produto removido com sucesso',
        product: deletedProduct,
    });
}