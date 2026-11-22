# Front-end Radar dos Preços

Interface React/Vite em português para selecionar e salvar a cesta e comparar preços.

Veja o [README principal](../README.md) para instalação, configuração, publicação e limitações.

- `npm run dev`: servidor de desenvolvimento.
- `npm run lint`: ESLint.
- `npm run build`: build em `dist`.
- `npm run preview`: preview do build.
- `VITE_API_URL`: endereço da API usado apenas no desenvolvimento local (padrão `http://localhost:3000`).

No desenvolvimento, a interface usa o catálogo e a API locais. No build publicado, lê o snapshot estático gerado pelo GitHub Actions em `public/data/prices.json`.

## Avaliação do site com Google Forms e Google Sheets

O rodapé apresenta um link «Avaliar o site» quando `VITE_FEEDBACK_FORM_URL` contém
um link HTTPS de resposta do Google Forms (`docs.google.com/forms/d/.../viewform`
ou `forms.gle/...`). O formulário abre numa nova aba, preservando a cesta.
O formulário do projeto já está configurado como destino padrão no componente
`FeedbackFooter.jsx`, incluindo no GitHub Pages quando a variável está vazia.
Uma variável preenchida substitui esse destino; se contiver um endereço inválido,
o rodapé informa que a avaliação estará disponível em breve.

### Criar o formulário e guardar as respostas

1. Na conta Google que será dona das respostas, abra <https://script.google.com/> e crie um projeto.
2. Copie o conteúdo de [create-feedback-form.gs](../scripts/create-feedback-form.gs) para o editor.
3. Execute `criarFormularioAvaliacao` e autorize o acesso a Forms e Sheets solicitado pelo Google.
4. O script cria cinco perguntas obrigatórias de escolha múltipla e liga o formulário a uma nova folha Google Sheets. O registo da execução mostra os links para responder, editar e consultar a folha.
5. No formulário, confirme em **Publicar/Gerir** o acesso dos respondentes. Teste o link numa janela privada: as políticas de contas escolares ou empresariais podem restringir o acesso externo.
6. Faça uma resposta de teste e confirme que aparece tanto em **Respostas** no Forms como na folha ligada. O script não envia respostas de teste automaticamente.

As perguntas avaliam facilidade de seleção e quantidades, clareza da comparação,
utilidade para compras, rapidez percebida e satisfação geral. Cada pergunta tem
cinco opções numeradas de 1 (pior) a 5 (melhor). O formulário não pede nome nem
email, não publica o resumo das respostas e não exige uma resposta por conta.
Por isso, os resultados podem incluir respostas repetidas de uma mesma pessoa.

### Ativar o link

- Localmente: defina `VITE_FEEDBACK_FORM_URL` em `frontend/.env.local` e reinicie o Vite.
- No GitHub: em **Settings → Secrets and variables → Actions → Variables**, crie
  a variável de repositório `VITE_FEEDBACK_FORM_URL` com o link para **responder**.
  Execute novamente o workflow **Update data and deploy GitHub Pages** depois de
  publicar estas alterações no repositório. O endereço é incluído na compilação.
- Nunca use o link de edição nem o link da folha de respostas como destino do rodapé.
  Nenhuma credencial Google precisa de ser colocada no frontend.

### Acompanhar os resultados

Use **Respostas → Resumo** no Google Forms para ver a distribuição das respostas
por pergunta. Na folha Google Sheets, cada resposta fica numa linha com data e
hora e as cinco escolhas, permitindo comparar semanas ou meses.

Indicadores úteis: quantidade de avaliações por semana, percentagem de notas 4
ou 5 em cada pergunta e percentagem de notas 1 ou 2. Compare sempre períodos e
números de respostas semelhantes. Pode criar uma tabela dinâmica por semana e
por opção escolhida, acompanhada de um gráfico.

Estas avaliações medem a experiência declarada pelos respondentes. Não medem
automaticamente visitas, taxa de conversão, erros ou tempo real de carregamento.
Mantenha a folha e o acesso de edição restritos aos responsáveis pelo projeto.

Documentação: [guardar respostas numa folha](https://support.google.com/docs/answer/2917686)
e [serviço Google Forms do Apps Script](https://developers.google.com/apps-script/reference/forms).
