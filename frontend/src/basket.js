export const MAX_QUANTITY = 999

export function readBasket(storage) {
  const current = storage.getItem('radar-basket-items')
  const stored = JSON.parse(current ?? storage.getItem('radar-basket-product-ids') ?? '[]')
  const items = current === null && Array.isArray(stored) ? stored.map(id => ({ id, quantity: 1 })) : stored
  if (!Array.isArray(items) || items.length > 100 || items.some(item =>
    !item || !Number.isSafeInteger(item.id) || item.id <= 0 ||
    !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) ||
    new Set(items.map(item => item.id)).size !== items.length) {
    throw new Error('A seleção salva neste navegador está inválida.')
  }
  return items
}

export function compareSelection(snapshot, selection) {
  const quantities = new Map(selection.map(item => [item.id, item.quantity]))
  const selectedIds = new Set(quantities.keys())
  const products = snapshot.products.filter(product => selectedIds.has(product.id))
  const markets = snapshot.markets.map(market => {
    const items = products.map(product => {
      const item = market.items.find(candidate => candidate.product.id === product.id)
      if (!item) throw new Error(`O snapshot não contém ${product.name} para ${market.name}.`)
      return { ...item, units: quantities.get(product.id) }
    })
    const complete = products.length > 0 && items.every(item => item.usable)
    const subtotal = items.filter(item => item.usable).reduce((sum, item) => sum + Math.round(item.price.price * 100) * item.units, 0) / 100
    const savedItems = items.filter(item => item.price)
    const savedSubtotal = savedItems.reduce((sum, item) => sum + Math.round(item.price.price * 100) * item.units, 0) / 100
    return {
      ...market,
      items,
      missingProducts: items.filter(item => !item.usable).map(item => item.product),
      complete,
      subtotal,
      savedSubtotal,
      savedItemCount: savedItems.length,
      total: complete ? subtotal : null,
    }
  })
  const incompatibleProducts = products.filter(product => {
    const quantities = markets
      .map(market => market.items.find(item => item.product.id === product.id))
      .filter(item => item?.usable)
      .map(item => item.price.quantity)
    return new Set(quantities).size > 1
  })
  const comparable = markets.length >= 2 && markets.every(market => market.complete) && incompatibleProducts.length === 0
  const minimum = comparable ? Math.min(...markets.map(market => market.total)) : null
  return {
    products,
    markets,
    incompatibleProducts,
    cheapestMarketIds: comparable ? markets.filter(market => market.total === minimum).map(market => market.id) : [],
  }
}
