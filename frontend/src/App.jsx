// Renderiza a cesta salva, a comparação de preços e o estado das coletas.
import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import './App.css'

const money = value => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
const labels = { sucesso: 'Concluída', parcial: 'Com falhas', erro: 'Falhou', em_andamento: 'Em andamento', sem_coleta: 'Sem coleta' }
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
  const [comparison, setComparison] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const dirty = [...selected].sort((a, b) => a - b).join() !== [...saved].sort((a, b) => a - b).join()
  const date = value => value ? new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Lisbon' }).format(new Date(value)) : 'Ainda não coletado'

  const refresh = useCallback(async productIds => {
    const query = new URLSearchParams({ productIds: productIds.join(',') })
    const result = await api(`/compare/basket?${query}`)
    setComparison(result.data)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const catalog = await api('/products')
      setProducts(catalog.data)
      const stored = JSON.parse(window.localStorage.getItem('radar-basket-product-ids') || '[]')
      if (!Array.isArray(stored) || stored.length > 100 || stored.some(id => !Number.isSafeInteger(id) || id <= 0)
        || new Set(stored).size !== stored.length) throw new Error('A seleção salva neste navegador está inválida.')
      const available = new Set(catalog.data.filter(product => product.basketOption).map(product => product.id))
      const productIds = stored.filter(id => available.has(id))
      setSelected(productIds)
      setSaved(productIds)
      await refresh(productIds)
    } catch (cause) { setError(cause.message || 'Não foi possível conectar à API.') }
    finally { setLoading(false) }
  }, [refresh])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timer = setInterval(() => { refresh(saved).catch(cause => setError(cause.message)) }, 60000)
    return () => clearInterval(timer)
  }, [refresh, saved])
  useEffect(() => {
    if (!notice || notice.startsWith('Consultando os mercados.')) return
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  async function save() {
    setBusy('save'); setError(''); setNotice('')
    try {
      const productIds = [...selected]
      window.localStorage.setItem('radar-basket-product-ids', JSON.stringify(productIds))
      setSaved(productIds)
      setNotice('Cesta salva neste navegador.')
      await refresh(productIds)
    } catch (cause) { setNotice(''); setError(cause.message) }
    finally { setBusy('') }
  }
  function toggle(id) {
    setNotice('')
    setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
  }

  const options = products.filter(p => p.basketOption)
  const winners = comparison?.markets.filter(m => comparison.cheapestMarketIds.includes(m.id)) || []

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/"><span className="radar-mark" aria-hidden="true">◉</span> Radar dos Preços</a>
      </header>
      <main>
        <section className="intro">
          <h1>Uma cesta.<br /><span>Mais economia.</span></h1>
          <p>Escolha o essencial e acompanhe os preços do Continente e do Pingo Doce, lado a lado.</p>
        </section>

        {error && <div className="alert error" role="alert">{error} <button className="text-button" onClick={load} disabled={!!busy}>Tentar novamente</button></div>}
        {notice && <div className="alert" role="status">{notice}</div>}

        {loading ? <div className="panel loading" role="status">Carregando sua cesta e os últimos preços…</div> : (
          <div className="workspace">
            <aside className="panel basket">
              <div className="section-heading"><h2>Sua cesta básica</h2><span className="count">{selected.length}</span></div>
              <p className="muted">Uma embalagem de cada produto selecionado.</p>
              <div className="selection-tools">
                <button className="text-button" disabled={!!busy} onClick={() => setSelected(options.map(p => p.id))}>Selecionar todos</button>
                <button className="text-button" disabled={!!busy} onClick={() => setSelected([])}>Limpar</button>
              </div>
              <fieldset disabled={!!busy}>
                <legend className="sr-only">Produtos da cesta básica</legend>
                {options.map(product => <label className="product-option" key={product.id}>
                  <input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggle(product.id)} />
                  <span>{product.name}</span>
                </label>)}
              </fieldset>
              {!options.length && <p>Nenhum produto disponível. Verifique a inicialização da API.</p>}
              <button className="primary" onClick={save} disabled={!!busy || !dirty}>{busy === 'save' ? 'Salvando…' : 'Salvar cesta'}</button>
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
                        <p className="small muted">{market.complete ? 'Total de uma embalagem por item' : market.savedItemCount ? `Subtotal dos últimos preços salvos (${market.savedItemCount}/${market.items.length} itens) · não comparável` : 'Nenhum preço salvo para os itens selecionados'}</p>
                        {!market.complete && <p className="missing">Faltam preços válidos: {market.missingProducts.map(p => p.name).join(', ')}.</p>}
                        <ul className="price-list">{market.items.map(item => <li key={item.product.id}>
                          <div className="price-line"><strong>{item.product.name}</strong><b>{item.price ? money(item.price.price) : 'Sem preço'}</b></div>
                          {item.price && <>
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
