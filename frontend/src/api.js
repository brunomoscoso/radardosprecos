// Centraliza as chamadas HTTP do front-end para a API do Radar dos Preços.
const base = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')
export async function api(path, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } })
  const body = await response.json().catch(() => { throw new Error('A API devolveu uma resposta inválida.') })
  if (!response.ok) throw new Error(body.message || 'Não foi possível concluir o pedido.')
  return body
}
