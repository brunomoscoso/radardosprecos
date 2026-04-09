import { Request, Response } from "express";
import { 
    findAllProducts, 
    findProductById,
    createNewProduct,
    updateExistingProduct,
    deleteExistingProduct
} from '../services/productService';
import { validateProductData } from '../validators/productValidator';


export function getProducts(req: Request, res: Response): void {
    const products = findAllProducts();
    res.status(200).json({
        success: true,
        data: products,
    });
}

export function getProductById(req: Request, res: Response): void {
    const id = Number(req.params.id);
    const product = findProductById(id);

    if(!product){
        res.status(404).json({ 
            success: false,
            message: "Produto não encontrado" });
        return;
    }
    res.status(200).json({
        success: true,
        data: product
    });     
}

export function createProduct(req: Request, res: Response): void {
    const { name, price } = req.body;

    const error = validateProductData(name, price);
    if(error.name || error.price){
        res.status(400).json(
            {
                success: false,
                errors: error
            });
        return;
    }

    const newProduct = createNewProduct(name, price);

    res.status(201).json({
        success: true,
        data: newProduct
    });
}

export function updateProduct(req: Request, res: Response): void {
    const id = Number(req.params.id);
    const { name, price } = req.body;

    const error = validateProductData(name, price);

if (error.name || error.price) {
    res.status(400).json({ 
        success: false,
        errors: error
    });
    return;
}

const updatedProduct = updateExistingProduct(id, name, price);

if (!updatedProduct) {
    res.status(404).json({ 
        success: false,
        message: "Produto não encontrado" 
    });
    return;
}

res.status(200).json({
    success: true,
    data: updatedProduct
});
}

export function deleteProduct(req: Request, res: Response): void {
    const id = Number(req.params.id);

    const deletedProduct = deleteExistingProduct(id);

    if (!deletedProduct) {
        res.status(404).json({ 
            success: false,
            message: "Produto não encontrado" 
        });
        return;
    }

    res.status(200).json({
        success: true,
        message: 'Produto removido com sucesso',
        product: deletedProduct,
    });
}