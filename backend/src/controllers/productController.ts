import { Request, Response } from "express";
import {
    findAllProducts,
    findProductById,
    createNewProduct,
    updateExistingProduct,
    deleteExistingProduct,
} from "../services/productService";
import { validateProductData } from "../validators/productValidator";

export async function getProducts(req: Request, res: Response): Promise<void> {
    try {
        const products = await findAllProducts();

        res.status(200).json({
            success: true,
            data: products,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Erro ao buscar produtos",
        });
    }
}

export async function getProductById(req: Request, res: Response): Promise<void> {
    try {
        const id = Number(req.params.id);
        const product = await findProductById(id);

        if (!product) {
            res.status(404).json({
                success: false,
                message: "Produto não encontrado",
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: product,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Erro ao buscar produto",
        });
    }
}

export async function createProduct(req: Request, res: Response): Promise<void> {
    try {
        const { name, category, description } = req.body;

        const errors = validateProductData(name, category, description);

        if (errors.name || errors.category || errors.description) {
            res.status(400).json({
                success: false,
                errors,
            });
            return;
        }

        const newProduct = await createNewProduct({
            name,
            category,
            description,
        });

        res.status(201).json({
            success: true,
            data: newProduct,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Erro ao criar produto",
        });
    }
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
    try {
        const id = Number(req.params.id);
        const { name, category, description } = req.body;

        const errors = validateProductData(name, category, description);

        if (errors.name || errors.category || errors.description) {
            res.status(400).json({
                success: false,
                errors,
            });
            return;
        }

        const updatedProduct = await updateExistingProduct(id, {
            name,
            category,
            description,
        });

        if (!updatedProduct) {
            res.status(404).json({
                success: false,
                message: "Produto não encontrado",
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: updatedProduct,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Erro ao atualizar produto",
        });
    }
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
    try {
        const id = Number(req.params.id);

        const deletedProduct = await deleteExistingProduct(id);

        if (!deletedProduct) {
            res.status(404).json({
                success: false,
                message: "Produto não encontrado",
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Produto removido com sucesso",
            product: deletedProduct,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Erro ao remover produto",
        });
    }
}