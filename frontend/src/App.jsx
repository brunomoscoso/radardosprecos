// Renderiza a cesta salva, a comparação de preços e o estado das coletas.
import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { compareSelection, readBasket, MAX_QUANTITY } from './basket'
import './App.css'

const money = value => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
const labels = { sucesso: 'Concluída', parcial: 'Com falhas', erro: 'Falhou', em_andamento: 'Em andamento', sem_coleta: 'Sem coleta' }

async function fetchSnapshot() {
  const response = await fetch(`${import.meta.env.BASE_URL}data/prices.json?updated=${Date.now()}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Não foi possível carregar os preços publicados (HTTP ${response.status}).`)
  let payload
  try { payload = await response.json() } catch { throw new Error('O arquivo de preços publicado está inválido.') }
  if (!payload?.comparison || !Array.isArray(payload.comparison.products) || !Array.isArray(payload.comparison.markets)) {
    throw new Error('O arquivo de preços publicado tem um formato inválido.')
  }
  return payload.comparison
}


function collectionErrorMessage(message) {
  if (/Executable doesn't exist/i.test(message)) return 'A última atualização falhou porque o navegador de coleta não estava instalado.'
  if (/PINGO_DOCE_POSTAL_CODE/i.test(message)) return 'A última atualização falhou porque a localização do Pingo Doce não estava configurada.'
  if (/browserType\.|page\.|locator\.|Timeout/i.test(message)) return 'Não foi possível atualizar o preço no site. Veja os detalhes da última consulta.'
  return message.split('\n')[0]
}

export default function App() {
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState([])
  const [saved, setSaved] = useState([])
  const [snapshot, setSnapshot] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selectionKey = items => JSON.stringify([...items].sort((a, b) => a.id - b.id))
  const dirty = selectionKey(selected) !== selectionKey(saved)
  const unitCount = selected.reduce((sum, item) => sum + item.quantity, 0)
  const date = value => value ? new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(value)) : 'Ainda não coletado'

  const refresh = useCallback(async selection => {
    const query = new URLSearchParams({ productIds: selection.map(item => item.id).join(',') })
    const result = await api(`/compare/basket?${query}`)
    setComparison(compareSelection(result.data, selection))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let availableProducts
      let publishedSnapshot = null
      if (import.meta.env.DEV) {
        availableProducts = (await api('/products')).data
        setProducts(availableProducts)
      } else {
        publishedSnapshot = await fetchSnapshot()
        availableProducts = publishedSnapshot.products
        setSnapshot(publishedSnapshot)
        setProducts(availableProducts)
      }
      const stored = readBasket(window.localStorage)
      const available = new Set(availableProducts.filter(product => product.basketOption).map(product => product.id))
      const productIds = stored.filter(item => available.has(item.id))
      setSelected(productIds)
      setSaved(productIds)
      if (publishedSnapshot) setComparison(compareSelection(publishedSnapshot, productIds))
      else await refresh(productIds)
    } catch (cause) { setError(cause.message || 'Não foi possível carregar os preços publicados.') }
    finally { setLoading(false) }
  }, [refresh])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timer = setInterval(() => {
      if (import.meta.env.DEV) {
        refresh(saved).catch(cause => setError(cause.message))
      } else {
        fetchSnapshot()
          .then(next => {
            setSnapshot(next)
            setProducts(next.products)
            setComparison(compareSelection(next, saved))
            setError('')
          })
          .catch(cause => setError(cause.message))
      }
    }, 60000)
    return () => clearInterval(timer)
  }, [refresh, saved])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  async function save() {
    setError('')
    setNotice('')
    try {
      const productIds = [...selected]
      window.localStorage.setItem('radar-basket-items', JSON.stringify(productIds))
      setSaved(productIds)
      setNotice('Cesta salva neste navegador.')
      if (import.meta.env.DEV) await refresh(productIds)
      else if (snapshot) setComparison(compareSelection(snapshot, productIds))
    } catch (cause) { setError(cause.message || 'Não foi possível salvar a cesta neste navegador.') }
  }
  function toggle(id) {
    setNotice('')
    setSelected(current => current.some(item => item.id === id) ? current.filter(item => item.id !== id) : [...current, { id, quantity: 1 }])
  }

  function changeQuantity(id, quantity) {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) return
    setNotice('')
    setSelected(current => current.map(item => item.id === id ? { ...item, quantity } : item))
  }

  const options = products.filter(p => p.basketOption)
  const winners = comparison?.markets.filter(m => comparison.cheapestMarketIds.includes(m.id)) || []

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL}><span className="radar-mark" aria-hidden="true">◉</span> Radar dos Preços</a>
      </header>
      <main>
        <section className="intro">
          <h1>Uma cesta.<br /><span>Mais economia.</span></h1>
          <p>Escolha o essencial e acompanhe os preços do Continente e do Pingo Doce, lado a lado.</p>
        </section>

        {error && <div className="alert error" role="alert">{error} <button className="text-button" onClick={load}>Tentar novamente</button></div>}
        {notice && <div className="alert" role="status">{notice}</div>}

        {loading ? <div className="panel loading" role="status">Carregando sua cesta e os últimos preços…</div> : (
          <div className="workspace">
            <aside className="panel basket">
              <div className="section-heading"><h2>Sua cesta básica</h2><span className="count">{unitCount}</span></div>
              <p className="muted">Escolha quantas embalagens deseja de cada produto.</p>
              <div className="selection-tools">
                <button className="text-button" onClick={() => setSelected(options.map(p => selected.find(item => item.id === p.id) || { id: p.id, quantity: 1 }))}>Selecionar todos</button>
                <button className="text-button" onClick={() => setSelected([])}>Limpar</button>
              </div>
              <fieldset>
                <legend className="sr-only">Produtos da cesta básica</legend>
                {options.map(product => {
                  const item = selected.find(item => item.id === product.id)
                  return <div className="product-row" key={product.id}>
                    <label className="product-option">
                      <input type="checkbox" checked={!!item} onChange={() => toggle(product.id)} />
                      <span>{product.name}</span>
                    </label>
                    {item && <div className="quantity-control" role="group" aria-label={`Quantidade de ${product.name}`}>
                      <button type="button" aria-label={`Diminuir quantidade de ${product.name}`} disabled={item.quantity <= 1} onClick={() => changeQuantity(product.id, item.quantity - 1)}>−</button>
                      <label>
                        <span className="sr-only">Quantidade de {product.name}</span>
                        <input type="number" min="1" max={MAX_QUANTITY} step="1" value={item.quantity} onChange={event => changeQuantity(product.id, Number(event.target.value))} />
                      </label>
                      <button type="button" aria-label={`Aumentar quantidade de ${product.name}`} disabled={item.quantity >= MAX_QUANTITY} onClick={() => changeQuantity(product.id, item.quantity + 1)}>+</button>
                      <span className="small muted">un.</span>
                    </div>}
                  </div>
                })}
              </fieldset>
              {!options.length && <p>{import.meta.env.DEV ? 'Nenhum produto disponível. Verifique a inicialização da API.' : 'Nenhum produto disponível no snapshot publicado.'}</p>}
              <button className="primary" onClick={save} disabled={!dirty}>Salvar cesta</button>
              <p className="small muted">{dirty ? 'Há alterações por salvar.' : 'Seleção salva neste navegador.'}</p>
            </aside>

            <section className="results" aria-label="Comparação de preços">
              <div className="results-header">
                <h2>Onde sua cesta custa menos?</h2>
              </div>
              <p className="small muted">Os preços do Pingo Doce consideram uma localização de entrega configurada.</p>
              {dirty ? <div className="panel empty"><h3>Salve sua nova seleção</h3><p>A comparação usará a seleção salva neste navegador.</p></div> :
                !saved.length ? <div className="panel empty"><span className="empty-icon" aria-hidden="true">＋</span><h3>Sua economia começa na cesta</h3><p>Selecione os produtos ao lado e salve para começar a comparar.</p></div> :
                  !comparison ? <div className="panel empty">Não foi possível carregar a comparação.</div> : <>
                    <div className={winners.length ? 'verdict winner' : 'verdict'}>
                      <strong>{winners.length ? winners.length > 1 ? 'Empate entre os mercados' : `${winners[0].name} tem a cesta mais barata` : 'Ainda não há uma comparação completa'}</strong>
                      <p>{winners.length ? 'Todos os itens têm preços válidos e embalagens equivalentes.' : 'Só indicamos o menor total quando os dois mercados têm todos os itens válidos e embalagens equivalentes.'}</p>
                      {comparison.incompatibleProducts.length > 0 && <p>Embalagens diferentes: {comparison.incompatibleProducts.map(p => p.name).join(', ')}.</p>}
                    </div>
                    <div className="market-grid">
                      {comparison.markets.map(market => <article className={comparison.cheapestMarketIds.includes(market.id) ? 'panel market best' : 'panel market'} key={market.id}>
                        <div className="section-heading"><h3>{market.name}</h3><span className="tag">{market.complete ? 'Cesta completa' : 'Incompleta'}</span></div>
                        <div className="total">{market.complete ? money(market.total) : market.savedItemCount ? money(market.savedSubtotal) : '—'}</div>
                        <p className="small muted">{market.complete ? 'Total para as quantidades selecionadas' : market.savedItemCount ? `Subtotal dos últimos preços salvos (${market.savedItemCount}/${market.items.length} itens) · não comparável` : 'Nenhum preço salvo para os itens selecionados'}</p>
                        {!market.complete && <p className="missing">Faltam preços válidos: {market.missingProducts.map(p => p.name).join(', ')}.</p>}
                        <ul className="price-list">{market.items.map(item => <li key={item.product.id}>
                          <div className="price-line"><strong>{item.product.name}</strong><b>{item.price ? money(Math.round(item.price.price * 100) * item.units / 100) : 'Sem preço'}</b></div>
                          {item.price && <>
                            <p className="small muted">{item.units} × {money(item.price.price)} por embalagem</p>
                            <p className="small muted">{item.price.legacy ? 'Preço histórico salvo' : 'Último preço salvo'} · {date(item.price.collectedAt)}</p>
                            {item.price.productUrl ? <a href={item.price.productUrl} target="_blank" rel="noreferrer">{item.price.matchedName || item.product.name}</a> : <span className="small">{item.price.matchedName || item.product.name}</span>}
                            <span className="small muted"> · {item.price.quantity || 'Embalagem não verificada'}</span>
                          </>}
                          {item.priceWarning && <p className="item-error">{item.priceWarning}</p>}
                          {(item.lastCollectionError || (item.status === 'erro' && item.error)) && <p className="item-error">
                            <span>{collectionErrorMessage(item.lastCollectionError || item.error)}</span>
                            {item.collectedAt && <span> Tentativa de {date(item.collectedAt)}.</span>}
                          </p>}
                          {!item.price && item.status !== 'erro' && <p className="item-error">{item.error || labels[item.status]}</p>}
                        </li>)}</ul>
                      </article>)}
                    </div>
                  </>}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
