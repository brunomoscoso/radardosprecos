import { Page } from "playwright";

export class MercadoAPage {
    constructor(private page: Page) {}

async acceptCookies(): Promise<void> {
    const cookieButton = this.page.locator(
        "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll"
    );

    if (await cookieButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await cookieButton.click();
        console.log("Cookies aceitos com sucesso.");
    }
    }

async searchProduct(productName: string): Promise<void> {
    const searchInput = this.page.locator("[aria-label='Introduza o termo que deseja pesquisar']");

    await searchInput.waitFor({ state: "visible" });
    await searchInput.fill("");
    await searchInput.fill(productName);
    await searchInput.press("Enter");

    console.log(`Busca realizada para: ${productName}`);
    }

async clickLowestPriceSearch(): Promise<void> {
    const lowestPriceButton = this.page.locator('#sort-order');

    await lowestPriceButton.waitFor({ state: "visible" });
    await lowestPriceButton.click({ timeout: 5000 });

    console.log("Filtro 'Menor Preço' aplicado.");

}

async selectLowestPrice(): Promise<void> {
    const sortOrderSelect = this.page.locator('#sort-order');

    await sortOrderSelect.waitFor({ state: 'visible' });
    await sortOrderSelect.selectOption({ label: 'Preço (menor)' });

    console.log("Filtro 'Menor Preço' aplicado.");
}

async waitForResults(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
    await this.page.waitForTimeout(3000);
    }

async getFirstProductData(): Promise<{
    productName: string | null;
    productPrice: string | null;
}> {
    const firstProduct = this.page.locator('.product-tile').first();

    await firstProduct.waitFor({ state: "visible", timeout: 10000 });

    const productName = await firstProduct
        .locator(".pwc-tile--description").first()
        .textContent();

    const productPrice = await firstProduct
        .locator(".pwc-tile--price-primary").first()
        .textContent();

    return {
        productName,
        productPrice
    };
    }
}