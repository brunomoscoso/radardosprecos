import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareSelection, readBasket } from './basket.js'

const products = [{ id: 1, name: 'Arroz' }, { id: 2, name: 'Leite' }]
function snapshot() {
  return {
    products,
    markets: [[1, 3], [2, 1]].map((prices, index) => ({
      id: index + 1,
      name: `Mercado ${index + 1}`,
      items: products.map((product, i) => ({ product, usable: true, price: { price: prices[i], quantity: '1000g' } })),
    })),
  }
}

test('quantidades alteram totais e mercado vencedor sem modificar os preços unitários', () => {
  const source = snapshot()
  const single = compareSelection(source, [{ id: 1, quantity: 1 }, { id: 2, quantity: 1 }])
  assert.deepEqual(single.cheapestMarketIds, [2])
  const multiple = compareSelection(source, [{ id: 1, quantity: 4 }, { id: 2, quantity: 1 }])
  assert.deepEqual(multiple.markets.map(m => m.total), [7, 9])
  assert.deepEqual(multiple.cheapestMarketIds, [1])
  assert.equal(source.markets[0].items[0].price.price, 1)
})

test('somas usam cêntimos e preços inválidos continuam fora da comparação', () => {
  const source = snapshot()
  source.markets[0].items[0].price.price = 0.1
  source.markets[0].items[1].price.price = 0.2
  const selection = [{ id: 1, quantity: 3 }, { id: 2, quantity: 1 }]
  assert.equal(compareSelection(source, selection).markets[0].total, 0.5)
  source.markets[0].items[0].usable = false
  const result = compareSelection(source, selection)
  assert.equal(result.markets[0].total, null)
  assert.equal(result.markets[0].savedSubtotal, 0.5)
  assert.equal(result.markets[0].subtotal, 0.2)
  assert.deepEqual(result.cheapestMarketIds, [])
  source.markets[0].items[0].price = null
  assert.equal(compareSelection(source, selection).markets[0].savedSubtotal, 0.2)
})

test('cesta vazia e embalagens incompatíveis não têm vencedor', () => {
  assert.deepEqual(compareSelection(snapshot(), []).cheapestMarketIds, [])
  const source = snapshot()
  source.markets[1].items[0].price.quantity = '500g'
  assert.deepEqual(compareSelection(source, [{ id: 1, quantity: 3 }]).cheapestMarketIds, [])
})

const storage = values => ({ getItem: key => values[key] ?? null })
test('migra cesta antiga e preserva quantidades após guardar e reabrir', () => {
  assert.deepEqual(readBasket(storage({ 'radar-basket-product-ids': '[1,2]' })), [{ id: 1, quantity: 1 }, { id: 2, quantity: 1 }])
  const items = [{ id: 1, quantity: 4 }]
  assert.deepEqual(readBasket(storage({ 'radar-basket-items': JSON.stringify(items) })), items)
  assert.deepEqual(readBasket(storage({ 'radar-basket-items': '[]', 'radar-basket-product-ids': '[1]' })), [])
  for (const quantity of [0, -1, 1.5, 1000, null, '2']) {
    assert.throws(() => readBasket(storage({ 'radar-basket-items': JSON.stringify([{ id: 1, quantity }]) })))
  }
})
