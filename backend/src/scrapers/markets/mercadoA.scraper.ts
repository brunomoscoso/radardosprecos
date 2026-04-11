import { chromium } from "playwright";
import { MercadoAPage } from "../pages/mercadoAPage";
import { productsToSearch } from "../config/products";
import { cleanText, parsePrice } from "../helpers/normalizeProductData";

export async function scrapeMercadoA(): Promise<void> {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    const mercadoAPage = new MercadoAPage(page);

try {
    await page.goto("https://www.continente.pt/", {
        waitUntil: "domcontentloaded",
    });

    console.log("Site carregado com sucesso.");

    await mercadoAPage.acceptCookies();

    for (const product of productsToSearch) {
        console.log(`Iniciando busca por: ${product}`);

    await mercadoAPage.searchProduct(product);
    await mercadoAPage.waitForResults();
    await mercadoAPage.acceptCookies();
    await mercadoAPage.clickLowestPriceSearch();
    await mercadoAPage.selectLowestPrice();

    const productData = await mercadoAPage.getFirstProductData();

    const normalizedData = {
                searchedProduct: product,
                productName: cleanText(productData.productName),
                price: parsePrice(productData.productPrice),
                marketId: 1,
                collectedAt: new Date().toISOString(),
            };

    console.log("Resultado coletado:", normalizedData);
    }
}   catch (error) {
    console.error("Erro ao executar scraper do Mercado A:", error);
}   finally {
    await browser.close();
}
}