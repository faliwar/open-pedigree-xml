const translations = {
  'Info': 'Informações', 'Output': 'Saída', 'Load': 'Carregar', 'Edit': 'Editar', 'Reset': 'Redefinir',
  'Unsuported browser mode': 'Modo de navegador não compatível', 'Export': 'Exportar', 'Close': 'Fechar',
  'Open XML': 'Abrir XML', 'Save XML': 'Salvar XML', 'Rename XML': 'Renomear XML', 'Templates': 'Modelos',
  'Import': 'Importar', 'Undo': 'Desfazer', 'Redo': 'Refazer', 'Re-layout': 'Reorganizar',
  'Labels': 'Rótulos', 'Clear all': 'Limpar tudo', 'Menu': 'Menu', 'Google Drive': 'Google Drive',
  'Powered by ': 'Com tecnologia ', 'Powered by PhenoTips®': 'Com tecnologia PhenoTips®',
  'Pan': 'Mover', 'Zoom': 'Zoom', 'Drag to zoom': 'Arraste para ajustar o zoom',
  'Maintained by Fabiano Poswar': 'Mantido por Fabiano Poswar',
  'Based on PhenoTips (2019–22)': 'Baseado no editor da PhenoTips (2019–22)',
  'Zoom in': 'Aumentar zoom', 'Zoom out': 'Diminuir zoom',
  'Drop pedigree file here to import': 'Solte aqui o arquivo de heredograma para importar',
  'Select an XML file from Google Drive:': 'Selecione um arquivo XML do Google Drive:',
  'Loading files...': 'Carregando arquivos...', 'No XML files found in the configured folder.': 'Nenhum arquivo XML encontrado na pasta configurada.',
  'File': 'Arquivo', 'Last modified': 'Última modificação', 'Open': 'Abrir', 'Cancel': 'Cancelar',
  'Open XML from Drive': 'Abrir XML do Drive', 'Error importing XML file: ': 'Erro ao importar arquivo XML: ',
  'Error loading file from Drive: ': 'Erro ao carregar arquivo do Drive: ',
  'No file currently loaded from Drive to rename.': 'Não há arquivo do Drive carregado para renomear.',
  'File renamed successfully to "': 'Arquivo renomeado com sucesso para "',
  'Error renaming file: ': 'Erro ao renomear arquivo: ',
  'No pedigree to save. Create or import a pedigree first.': 'Não há heredograma para salvar. Crie ou importe um primeiro.',
  'File "': 'Arquivo "', ' saved successfully!': ' salvo com sucesso!', 'Error saving: ': 'Erro ao salvar: ',
  ' created successfully!': ' criado com sucesso!', 'Error creating file: ': 'Erro ao criar arquivo: ',
  'Data format:': 'Formato dos dados:', 'Which of the following fields should be used to generate person IDs?': 'Qual dos campos a seguir deve ser usado para gerar os IDs das pessoas?',
  'External ID': 'ID externo', 'Name': 'Nome', 'None, generate new numeric ID for everyone': 'Nenhum; gerar novos IDs numéricos',
  'Privacy export options:': 'Opções de privacidade da exportação:', 'All data': 'Todos os dados',
  'Remove personal information (name and age)': 'Remover informações pessoais (nome e idade)',
  'Remove personal information and free-form comments': 'Remover informações pessoais e comentários livres',
  'PDF export options:': 'Opções de exportação para PDF:', 'Page Size ': 'Tamanho da página ',
  'Page Orientation ': 'Orientação da página ', 'Landscape': 'Paisagem', 'Portrait': 'Retrato',
  'Legend Position ': 'Posição da legenda ', 'Top Left': 'Superior esquerdo', 'Top Right': 'Superior direito',
  'Bottom Left': 'Inferior esquerdo', 'Bottom Right': 'Inferior direito',
  'Embed XML data in PDF (allows updating)': 'Incluir dados XML no PDF (permite atualização)',
  'Show generation (I, II, III...) and individual (1, 2, 3...) numbers': 'Exibir números das gerações (I, II, III...) e das pessoas (1, 2, 3...)',
  'Options:': 'Opções:', 'Copy to clipboard': 'Copiar para a área de transferência', 'Pedigree export': 'Exportar heredograma',
  'Import data:': 'Importar dados:', 'Select a local file to be imported': 'Selecione um arquivo local para importar',
  'AI / LLM Assistant': 'Assistente de IA / LLM', 'Generate Pedigree XML from Clinical Notes': 'Gerar XML de heredograma a partir de anotações clínicas',
  'Copy LLM Instructions (.md)': 'Copiar instruções para LLM (.md)', 'Copied!': 'Copiado!',
  'Download LLMInstructions.md': 'Baixar LLMInstructions.md',
  'Could not copy automatically. Please use the Download button instead.': 'Não foi possível copiar automaticamente. Use o botão Baixar.',
  'Data format:': 'Formato dos dados:', 'PED or LINKAGE (pre- or post- makeped)': 'PED ou LINKAGE (antes ou depois do makeped)',
  'Treat non-standard phenotype values as new disorders': 'Tratar valores de fenótipo fora do padrão como novos distúrbios',
  "Mark all patients with known disorder status with 'documented evaluation' mark": "Marcar todos os pacientes com estado do distúrbio conhecido como 'avaliação documentada'",
  "Save individual IDs as given in the input data as 'external ID'": "Salvar os IDs individuais conforme os dados de entrada como 'ID externo'",
  'Options:': 'Opções:', 'Pedigree import': 'Importar heredograma', 'This PDF does not contain embedded Pedigree data.': 'Este PDF não contém dados de heredograma incorporados.',
  'Nothing to import!': 'Não há nada para importar!', 'Label Display Options': 'Opções de exibição dos rótulos',
  'Name Display Format': 'Formato de exibição do nome', 'Full Name': 'Nome completo', 'First & Last Name': 'Nome e sobrenome',
  'First Name Only': 'Somente o primeiro nome', 'Hide Names': 'Ocultar nomes',
  'Select All': 'Selecionar tudo', 'Deselect All': 'Desmarcar tudo', 'Confirm': 'Confirmar',
  'Choose Common Children': 'Escolher filhos em comum', 'Male': 'Masculino', 'Female': 'Feminino', 'Unknown': 'Desconhecido',
  'Please select a pedigree template': 'Selecione um modelo de heredograma', 'Loading list of templates...': 'Carregando lista de modelos...',
  'Loading...': 'Carregando...', 'Your browser does not support all the features required for Pedigree Editor, so pedigree is displayed in read-only mode (and may have quirks).': 'Seu navegador não oferece suporte a todos os recursos necessários para o Editor de Heredogramas. O heredograma será exibido em modo somente leitura e pode apresentar limitações.',
  'All highlighted nodes will be removed. Do you want to proceed?': 'Todos os elementos destacados serão removidos. Deseja continuar?',
  'This person already has the specified disorder': 'Esta pessoa já tem o distúrbio especificado',
  "This person doesn't have the specified disorder": 'Esta pessoa não tem o distúrbio especificado',
  'This person already has the specified phenotype': 'Esta pessoa já tem o fenótipo especificado',
  'This person doesn\'t have the specified HPO term': 'Esta pessoa não tem o termo HPO especificado',
  'Unsupported file type: ': 'Tipo de arquivo não compatível: ', '\n\nCompatible formats: ': '\n\nFormatos compatíveis: ',
  'The file is empty.': 'O arquivo está vazio.', 'Error reading file "': 'Erro ao ler o arquivo "',
  'Error importing file "': 'Erro ao importar o arquivo "', 'Import pedigree from "': 'Importar o heredograma de "',
  '"?\n\nThis will replace the current pedigree.': '"?\n\nIsso substituirá o heredograma atual.',
  'Your browser is not supported and is unable to load and display any pedigrees.': 'Seu navegador não é compatível e não consegue carregar nem exibir heredogramas.',
  'GA4GH Export Error: ': 'Erro na exportação GA4GH: '
  , 'Create a person of male gender': 'Criar uma pessoa do sexo masculino'
  , 'Create a person of female gender': 'Criar uma pessoa do sexo feminino'
  , 'Create a person of unknown gender': 'Criar uma pessoa de sexo desconhecido'
  , 'Create twins (expandable to triplets or more)': 'Criar gêmeos (expansível para trigêmeos ou mais)'
  , 'Create a node representing multiple siblings': 'Criar um elemento que representa vários irmãos'
  , 'No children': 'Sem filhos', 'Multiple': 'Múltiplos', 'Twins': 'Gêmeos', 'Infertile': 'Infértil'
  , 'Mark as childless by choice': 'Marcar como sem filhos por opção', 'Mark as infertile': 'Marcar como infértil'
  , 'Choose which information to display directly in the label box below individuals:': 'Escolha quais informações exibir diretamente no rótulo abaixo das pessoas:'
  , 'Diagnoses (Disorders)': 'Diagnósticos (distúrbios)'
  , 'Display clinical diagnoses (e.g. Fabry disease, Down syndrome) on affected individuals.': 'Exibir diagnósticos clínicos (por exemplo, doença de Fabry, síndrome de Down) nas pessoas afetadas.'
  , 'Phenotypes (HPO Terms)': 'Fenótipos (termos HPO)'
  , 'Display Human Phenotype Ontology terms (e.g. Microcephaly, Seizures) on individuals.': 'Exibir termos da Ontologia do Fenótipo Humano (por exemplo, microcefalia, convulsões) nas pessoas.'
  , 'Candidate Genes': 'Genes candidatos', 'Display candidate genes (e.g. GLA, BRCA1) on individuals.': 'Exibir genes candidatos (por exemplo, GLA, BRCA1) nas pessoas.'
  , 'Comments (Notes)': 'Comentários (anotações)'
  , 'Display free-text clinical notes or testing status (e.g. untested) on individuals.': 'Exibir anotações clínicas em texto livre ou estado dos exames (por exemplo, não testado) nas pessoas.'
  , 'Include Category Indicators': 'Incluir indicadores de categoria'
  , 'Prefix entries with compact visual indicators (⬢ Diagnosis, ◈ Phenotype, ⧓ Gene, 🗎︎ Comment) for clarity.': 'Adicionar indicadores visuais compactos (⬢ diagnóstico, ◈ fenótipo, ⧓ gene, 🗎 comentário) para facilitar a leitura.'
  , "Choose how much of each individual's name to display on the pedigree chart.": 'Escolha quanto do nome de cada pessoa será exibido no heredograma.'
  , 'Done': 'Concluído', 'Select an XML file from Google Drive:': 'Selecione um arquivo XML do Google Drive:'
  , 'The file is empty.': 'O arquivo está vazio.', 'Please select a pedigree template': 'Selecione um modelo de heredograma'
  , 'The following formats are supported:': 'Os seguintes formatos são compatíveis:'
  , 'To edit: upload PDF to Open Pedigree X.': 'Para editar: envie o PDF para o Open Pedigree X.'
  , 'Your browser does not support all the features required for Pedigree Editor, so pedigree is displayed in read-only mode (and may have quirks).\n\nSupported browsers include Firefox v3.5+, Internet Explorer v9+, Chrome, Safari v4+, Opera v10.5+ and most mobile browsers.': 'Seu navegador não oferece suporte a todos os recursos necessários para o Editor de Heredogramas. O heredograma será exibido em modo somente leitura e pode apresentar limitações.\n\nNavegadores compatíveis incluem Firefox v3.5+, Internet Explorer v9+, Chrome, Safari v4+, Opera v10.5+ e a maioria dos navegadores móveis.'
  , 'Your browser is not supported and is unable to load and display any pedigrees.\n\nPlease use a modern browser such as Chrome, Firefox, Safari or Edge.': 'Seu navegador não é compatível e não consegue carregar nem exibir heredogramas.\n\nUse um navegador moderno, como Chrome, Firefox, Safari ou Edge.'
  , 'Shared children': 'Filhos em comum', 'children': 'filhos', ' child': ' filho', ' children': ' filhos'
  , 'The selected individuals will become parents of the selected children.': 'As pessoas selecionadas se tornarão pais dos filhos selecionados.'
  , 'Loading files...': 'Carregando arquivos...', 'No XML files found in the configured folder.': 'Nenhum arquivo XML encontrado na pasta configurada.'
  , 'No file currently loaded from Drive to rename.': 'Não há arquivo do Drive carregado para renomear.'
  , 'The selected file will replace the current pedigree.': 'O arquivo selecionado substituirá o heredograma atual.'
  , 'Unable to load templates.': 'Não foi possível carregar os modelos.'
  , 'Select an import format:': 'Selecione um formato de importação:'
  , 'Import data:': 'Importar dados:', 'Generate Pedigree XML from Clinical Notes': 'Gerar XML de heredograma a partir de anotações clínicas'
  , 'Data format:': 'Formato dos dados:', 'Import options:': 'Opções de importação:'
  , 'PDF export options:': 'Opções de exportação para PDF:', 'Export options:': 'Opções de exportação:'
  , 'There is no pedigree to export.': 'Não há heredograma para exportar.'
  , 'Error importing XML: ': 'Erro ao importar XML: ', 'Error loading file from Drive: ': 'Erro ao carregar arquivo do Drive: '
  , 'The file could not be loaded.': 'Não foi possível carregar o arquivo.'
  , 'Select a local file to be imported': 'Selecione um arquivo local para importar'
  , 'Select a template': 'Selecione um modelo'
  , 'Choose Common Children': 'Escolher filhos em comum'
  , 'Personal': 'Pessoal', 'Clinical': 'Clínico', 'Gender': 'Sexo', 'Identifier': 'Identificador'
  , 'Carrier status': 'Estado de portador', 'Not affected': 'Não afetado', 'Carrier': 'Portador'
  , 'Affected': 'Afetado', 'Pre-symptomatic': 'Pré-sintomático', 'Documented evaluation': 'Avaliação documentada'
  , 'Documented (*)': 'Documentado (*)', 'Positive +': 'Positivo +', 'Negative -': 'Negativo -'
  , 'Disorders': 'Distúrbios', 'Genes': 'Genes', 'Phenotypic features': 'Características fenotípicas'
  , 'Age': 'Idade', 'e.g. 44, 4 mo, 3 wk': 'ex.: 44, 4 meses, 3 semanas'
  , 'Date of birth': 'Data de nascimento', 'Date of death': 'Data do óbito', 'Individual is': 'A pessoa está'
  , 'Alive': 'Vivo', 'Stillborn': 'Natimorto', 'Deceased': 'Falecido', 'Miscarriage': 'Aborto espontâneo'
  , 'Unborn': 'Não nascido', 'Aborted': 'Aborto induzido', 'Gestation age': 'Idade gestacional'
  , 'Heredity options': 'Opções reprodutivas', 'None': 'Nenhum', 'Childless': 'Sem filhos', 'Adopted': 'Adotado'
  , 'Monozygotic twin': 'Gêmeo monozigótico', 'Not in contact with proband': 'Sem contato com o probando'
  , 'Proband': 'Probando', 'Placeholder node': 'Pessoa fictícia', 'Comments': 'Comentários'
  , 'Number of persons in this group': 'Número de pessoas neste grupo', 'Identifier(s)': 'Identificador(es)'
  , 'Known disorders': 'Distúrbios conhecidos', '(common to all individuals in the group)': '(comuns a todas as pessoas do grupo)'
  , 'All individuals in the group are': 'Todas as pessoas do grupo estão', 'Consanguinity of this relationship': 'Consanguinidade nesta relação'
  , 'Automatic': 'Automático', 'Yes': 'Sim', 'No': 'Não', 'Separated': 'Separados'
  , 'Copy instructions to clipboard': 'Copiar instruções para a área de transferência'
  , 'Copy instructions and run them with your clinical notes in your institution\'s HIPAA/GDPR-compliant AI (or ensure data is de-identified), then paste the generated XML above.': 'Copie as instruções e use-as com suas anotações clínicas em uma IA aprovada pela sua instituição para dados de saúde (ou desidentifique os dados). Depois, cole o XML gerado acima.'
  , 'Select All': 'Selecionar tudo', 'Deselect All': 'Desmarcar tudo'
  , 'has multiple children. Please select which children are shared with this partner:': 'tem vários filhos. Selecione quais filhos são deste parceiro:'
  , 'Enter new file name:': 'Digite o novo nome do arquivo:'
  , 'No file loaded from Drive.\nEnter a name for the new file:': 'Nenhum arquivo carregado do Drive.\nDigite um nome para o novo arquivo:'
  , 'Overwrite file "': 'Substituir o arquivo "', '" on Google Drive?': '" no Google Drive?'
  , 'Supported browsers include ': 'Navegadores compatíveis incluem ', 'Suported browsers include ': 'Navegadores compatíveis incluem '
  , 'This PDF does not contain embedded Pedigree data.': 'Este PDF não contém dados de heredograma incorporados.'
  , 'Error importing file "': 'Erro ao importar o arquivo "', 'Error reading file "': 'Erro ao ler o arquivo "'
  , 'Error importing XML file: ': 'Erro ao importar arquivo XML: ', 'Error loading file from Drive: ': 'Erro ao carregar arquivo do Drive: '
  , 'No pedigree to save. Create or import a pedigree first.': 'Não há heredograma para salvar. Crie ou importe um primeiro.'
  , 'Error saving: ': 'Erro ao salvar: ', 'Error creating file: ': 'Erro ao criar arquivo: '
  , 'No XML files found in the configured folder.': 'Nenhum arquivo XML encontrado na pasta configurada.'
  , 'Executive': 'Executivo', 'Legal': 'Ofício', 'Letter': 'Carta', 'Tabloid': 'Tabloide'
  , 'Done': 'Concluído'
  , 'Copy instructions to clipboard': 'Copiar instruções para a área de transferência'
  , 'Download LLMInstructions.md to attach to your AI chat': 'Baixar LLMInstructions.md para anexar à conversa com a IA'
  , 'PED or LINKAGE (pre- or post- makeped)': 'PED ou LINKAGE (antes ou depois do makeped)'
  , 'GEDCOM': 'GEDCOM', 'BOADICEA': 'BOADICEA', 'GA4GH FHIR(JSON)': 'GA4GH FHIR (JSON)', 'Invitae/Progeny (XML)': 'Invitae/Progeny (XML)'
  , 'Date of birth': 'Data de nascimento', 'Date of death': 'Data do óbito'
  , 'Choose which information to display directly in the label box below individuals:': 'Escolha quais informações exibir diretamente no rótulo abaixo das pessoas:'
  , 'Diagnoses (Disorders)': 'Diagnósticos (distúrbios)'
  , 'Display clinical diagnoses (e.g. Fabry disease, Down syndrome) on affected individuals.': 'Exibir diagnósticos clínicos (por exemplo, doença de Fabry, síndrome de Down) nas pessoas afetadas.'
  , 'Phenotypes (HPO Terms)': 'Fenótipos (termos HPO)'
  , 'Display Human Phenotype Ontology terms (e.g. Microcephaly, Seizures) on individuals.': 'Exibir termos da Ontologia do Fenótipo Humano (por exemplo, microcefalia, convulsões) nas pessoas.'
  , 'Candidate Genes': 'Genes candidatos', 'Display candidate genes (e.g. GLA, BRCA1) on individuals.': 'Exibir genes candidatos (por exemplo, GLA, BRCA1) nas pessoas.'
  , 'Comments (Notes)': 'Comentários (anotações)'
  , 'Display free-text clinical notes or testing status (e.g. untested) on individuals.': 'Exibir anotações clínicas em texto livre ou estado dos exames (por exemplo, não testado) nas pessoas.'
  , 'Include Category Indicators': 'Incluir indicadores de categoria'
  , 'Prefix entries with compact visual indicators (⬢ Diagnosis, ◈ Phenotype, ⧓ Gene, 🗎︎ Comment) for clarity.': 'Adicionar indicadores visuais compactos (⬢ diagnóstico, ◈ fenótipo, ⧓ gene, 🗎 comentário) para facilitar a leitura.'
  , "Choose how much of each individual's name to display on the pedigree chart.": 'Escolha quanto do nome de cada pessoa será exibido no heredograma.'
  , 'Name Display Format': 'Formato de exibição do nome', 'Full Name': 'Nome completo', 'First & Last Name': 'Nome e sobrenome'
  , 'First Name Only': 'Somente o primeiro nome', 'Hide Names': 'Ocultar nomes'
  , 'AI / LLM Assistant': 'Assistente de IA / LLM', 'Generate Pedigree XML from Clinical Notes': 'Gerar XML de heredograma a partir de anotações clínicas'
  , 'Copy LLM Instructions (.md)': 'Copiar instruções para LLM (.md)', 'Copied!': 'Copiado!'
  , 'Could not copy automatically. Please use the Download button instead.': 'Não foi possível copiar automaticamente. Use o botão Baixar.'
  , 'Download LLMInstructions.md': 'Baixar LLMInstructions.md'
  , 'Copy instructions and run them with your clinical notes in your institution\'s HIPAA/GDPR-compliant AI (or ensure data is de-identified), then paste the generated XML above.': 'Copie as instruções e use-as com suas anotações clínicas em uma IA aprovada pela sua instituição para dados de saúde (ou desidentifique os dados). Depois, cole o XML gerado acima.'
  , 'Loading list of templates...': 'Carregando lista de modelos...', 'Loading...': 'Carregando...'
  , 'There is no pedigree to export.': 'Não há heredograma para exportar.'
  , 'To edit: upload PDF to Open Pedigree X.': 'Para editar: envie o PDF para o Open Pedigree X.'
  , 'has multiple children. Please select which children are shared with this partner:': 'tem vários filhos. Selecione quais filhos são deste parceiro:'
  , 'Generate pedigree XML from clinical notes': 'Gerar heredograma XML de notas clínicas'
  , 'Use these instructions with de-identified notes in an institution-approved AI, then paste the XML above.': 'Use as instruções com dados desidentificados em uma IA aprovada pela instituição; depois, cole o XML acima.'
};

export function getLanguage() {
  var pageLanguage = document.documentElement.getAttribute('lang') || 'en';
  return pageLanguage.toLowerCase().indexOf('pt') === 0 ? 'pt-BR' : 'en';
}

export function translate(text) {
  if (getLanguage() !== 'pt-BR' || !text) return text;
  var exact = translations[text];
  if (exact) return exact;
  // Translate known fragments in interpolated status and error messages.
  return Object.keys(translations).filter(function(key) { return key.length > 8 && text.indexOf(key) !== -1; })
    .reduce(function(result, key) { return result.split(key).join(translations[key]); }, text);
}

function translateNode(node) {
  if (!node) return;
  if (node.nodeType === 3) {
    var translated = translate(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
    return;
  }
  if (node.nodeType !== 1 && node.nodeType !== 9) return;
  if (node.nodeType === 1) {
    ['title', 'aria-label', 'placeholder', 'value'].forEach(function(attribute) {
      if (node.hasAttribute(attribute)) {
        var value = node.getAttribute(attribute);
        var translatedValue = translate(value);
        if (translatedValue !== value) node.setAttribute(attribute, translatedValue);
      }
    });
  }
  Array.prototype.slice.call(node.childNodes || []).forEach(translateNode);
}

export function observeTranslations(root) {
  if (!root || getLanguage() !== 'pt-BR' || typeof MutationObserver === 'undefined') return;
  translateNode(root);
  var observer = new MutationObserver(function(records) {
    records.forEach(function(record) {
      if (record.type === 'childList') Array.prototype.slice.call(record.addedNodes).forEach(translateNode);
      else if (record.type === 'characterData') translateNode(record.target);
      else if (record.type === 'attributes') translateNode(record.target);
    });
  });
  observer.observe(root, { childList: true, characterData: true, attributes: true, subtree: true, attributeFilter: ['title', 'aria-label', 'placeholder', 'value'] });
}

export function installNativeDialogTranslations() {
  if (getLanguage() !== 'pt-BR') return;
  var originalAlert = window.alert;
  var originalConfirm = window.confirm;
  var originalPrompt = window.prompt;
  window.alert = function(message) { return originalAlert.call(window, translate(String(message))); };
  window.confirm = function(message) { return originalConfirm.call(window, translate(String(message))); };
  window.prompt = function(message, defaultValue) { return originalPrompt.call(window, translate(String(message)), defaultValue); };
}
