import './FeedbackFooter.css'

function formUrl(value) {
  try {
    const url = new URL(value)
    const isGoogleForm = (url.hostname === 'forms.gle' && url.pathname.length > 1) ||
      (url.hostname === 'docs.google.com' && /^\/forms\/d\/(?:e\/)?[^/]+\/viewform\/?$/.test(url.pathname))
    return url.protocol === 'https:' && !url.username && !url.password && isGoogleForm ? url.href : null
  } catch {
    return null
  }
}

export default function FeedbackFooter() {
  const url = formUrl(import.meta.env.VITE_FEEDBACK_FORM_URL ||
    'https://docs.google.com/forms/d/e/1FAIpQLSfKJeIAX1o1NbZOnWIhdBQJOwFYO4_3WxNVQxqD38qIu6WERw/viewform')
  return <footer className="feedback-footer">
    {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="feedback-link" aria-label="Avaliar o site (abre numa nova aba)">
      Avaliar o site
    </a> : <p className="feedback-pending">Avaliação disponível em breve.</p>}
  </footer>
}
