// Lista inicial de produtos usados para montar e popular a cesta básica.
export const productsToSearch: string[] = [
    "Arroz Agulha 1kg",
    "Feijão Manteiga 500g",
    "Leite UHT Meio Gordo 1L",
    "Óleo de Girassol 1L",
    "Açúcar Branco 1kg",
    "Massa Esparguete 500g",
    "Farinha de Trigo T55 sem Fermento 1kg",
    "Sal Fino 250g",
    "Manteiga com Sal 250g",
];

// Transfer selections to specific products; retain the old records and their prices.
export const basketReplacements: Record<string, string> = {
    'Feijão Manteiga': 'Feijão Manteiga 500g',
    'Leite UHT Meio Gordo': 'Leite UHT Meio Gordo 1L',
    'Óleo Alimentar': 'Óleo de Girassol 1L',
    'Açúcar Branco': 'Açúcar Branco 1kg',
    'Macarrão Espaguete 1kg': 'Massa Esparguete 500g',
    'Farinha Branca de Trigo 1kg': 'Farinha de Trigo T55 sem Fermento 1kg',
    'Farinha de Trigo sem Fermento 1kg': 'Farinha de Trigo T55 sem Fermento 1kg',
    'Sal Refinado 1kg': 'Sal Fino 250g',
    'Manteiga Vegetal 250g': 'Manteiga com Sal 250g',
};
