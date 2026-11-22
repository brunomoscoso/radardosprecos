/**
 * Executar uma vez em https://script.google.com/ na conta que será dona dos dados.
 * Selecione criarFormularioAvaliacao e clique em Executar.
 * O registo de execução mostra os links do formulário e da folha de respostas.
 * Reexecutar no mesmo projeto reutiliza os ficheiros já criados.
 */
function criarFormularioAvaliacao() {
  const properties = PropertiesService.getScriptProperties();
  const savedFormId = properties.getProperty('RADAR_FEEDBACK_FORM_ID');
  const form = savedFormId
    ? FormApp.openById(savedFormId)
    : FormApp.create('Avalie o Radar dos Preços', false);
  properties.setProperty('RADAR_FEEDBACK_FORM_ID', form.getId());

  const questions = [
    ['Foi fácil escolher os produtos e ajustar as quantidades?',
      ['1 — Muito difícil', '2 — Difícil', '3 — Nem fácil nem difícil', '4 — Fácil', '5 — Muito fácil']],
    ['A comparação de preços entre os supermercados é clara?',
      ['1 — Nada clara', '2 — Pouco clara', '3 — Razoavelmente clara', '4 — Clara', '5 — Muito clara']],
    ['O site é útil para planear as suas compras?',
      ['1 — Nada útil', '2 — Pouco útil', '3 — Razoavelmente útil', '4 — Útil', '5 — Muito útil']],
    ['Como avalia a rapidez de carregamento e utilização do site?',
      ['1 — Muito lento', '2 — Lento', '3 — Razoável', '4 — Rápido', '5 — Muito rápido']],
    ['Qual é a sua satisfação geral com o Radar dos Preços?',
      ['1 — Muito insatisfeito', '2 — Insatisfeito', '3 — Nem satisfeito nem insatisfeito', '4 — Satisfeito', '5 — Muito satisfeito']],
  ];

  // Só completa perguntas em falta; não altera perguntas de um formulário em uso.
  const existingTitles = form.getItems().map(item => item.getTitle());
  questions.forEach(([title, choices]) => {
    if (!existingTitles.includes(title)) {
      form.addMultipleChoiceItem().setTitle(title).setChoiceValues(choices).setRequired(true);
    }
  });
  form.setDescription('Ajude a melhorar o Radar dos Preços. São cinco perguntas de escolha múltipla, com uma resposta por pergunta. Não pedimos nome nem email. As respostas serão usadas para avaliar e melhorar o site e serão guardadas no Google Forms e numa folha Google Sheets do responsável pelo projeto.');
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setPublishingSummary(false);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage('Obrigado! A sua avaliação foi registada e vai ajudar a melhorar o Radar dos Preços.');

  // A consulta getDestinationId() lança uma exceção antes de existir um destino.
  let spreadsheetId = properties.getProperty('RADAR_FEEDBACK_SHEET_ID');
  if (!spreadsheetId) {
    spreadsheetId = SpreadsheetApp.create('Radar dos Preços — Avaliações').getId();
    properties.setProperty('RADAR_FEEDBACK_SHEET_ID', spreadsheetId);
  }
  form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheetId);
  form.setPublished(true);
  form.setAcceptingResponses(true);

  Logger.log('Link para configurar no site: ' + form.getPublishedUrl());
  Logger.log('Editar e consultar o resumo: ' + form.getEditUrl());
  Logger.log('Folha de respostas: ' + SpreadsheetApp.openById(spreadsheetId).getUrl());
  Logger.log('Confirme em Publicar/Gerir que qualquer pessoa com o link pode responder e teste numa janela privada.');
}
