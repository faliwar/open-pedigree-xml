const translations = {
  // CanRisk export (longer fragments first: messages are translated piece by piece)
  'CanRisk export options:': 'Opções da exportação CanRisk:', 'Calculate risk for ': 'Calcular o risco para ',
  'Names are replaced by generation identifiers (I-1, II-3) and dates by age and year of birth, because the file is uploaded to canrisk.org.': 'Os nomes são substituídos pelos identificadores de geração (I-1, II-3) e as datas por idade e ano de nascimento, porque o arquivo é enviado ao canrisk.org.',
  'CanRisk export failed: ': 'Falha na exportação CanRisk: ', 'CanRisk file created with the following notes:': 'Arquivo CanRisk criado com as seguintes observações:',
  'The person chosen for the risk calculation cannot be exported (unknown sex, pregnancy or group).': 'A pessoa escolhida para o cálculo de risco não pode ser exportada (sexo desconhecido, gestação ou grupo).',
  ' unrecorded parent(s) added as "dummy" (CanRisk needs both parents or none).': ' genitor(es) não registrado(s) adicionado(s) como "dummy" (o CanRisk exige os dois pais ou nenhum).',
  ': not one of the cancers used by CanRisk (breast, ovarian, prostate, pancreatic); not exported.': ': não é um dos cânceres usados pelo CanRisk (mama, ovário, próstata, pâncreas); não exportado.',
  'adopted, exported without parents (not a blood relative).': 'adotado(a), exportado(a) sem pais (não é parente consanguíneo).',
  ': same-sex parents; ': ': pais do mesmo sexo; ', ' was left out as a parent (CanRisk needs a biological father and mother).': ' foi deixado(a) de fora como genitor(a) (o CanRisk exige pai e mãe biológicos).',
  'sex unknown, left out (CanRisk needs M or F).': 'sexo desconhecido, deixado(a) de fora (o CanRisk exige M ou F).',
  'sex unknown, exported as ': 'sexo desconhecido, exportado(a) como ',
  ' does not match the sex and was not counted.': ' não corresponde ao sexo e não foi considerado.',
  ' is in situ and was not counted.': ' é in situ e não foi considerado.',
  'age at diagnosis of ': 'idade ao diagnóstico de ', ' is above the age ': ' é maior que a idade ',
  'termination of pregnancy': 'interrupção da gestação', 'group of people': 'grupo de pessoas',
  'stillbirth': 'natimorto', 'pregnancy': 'gestação', 'left out.': 'deixado(a) de fora.',
  // Ancestry (values are stored in English; these are only the displayed names)
  'Ancestry': 'Ancestralidade', 'Ancestry:': 'Ancestralidade:', 'Add ancestry…': 'Adicionar ancestralidade…',
  'Add another ancestry…': 'Adicionar outra ancestralidade…', 'Other (type)…': 'Outra (digitar)…',
  'Type and press Enter': 'Digite e pressione Enter',
  'Display the recorded ancestry (e.g. Ashkenazi Jewish, East Asian) under each person.': 'Exibe a ancestralidade registrada (ex.: judaica asquenaze, leste-asiática) abaixo de cada pessoa.',
  'African / African American': 'Africana / afro-americana', 'Admixed American / Latino': 'Latino-americana (miscigenada)',
  'Amish': 'Amish', 'Ashkenazi Jewish': 'Judaica asquenaze', 'Southeast Asian': 'Sudeste-asiática', 'East Asian': 'Leste-asiática',
  'European (non-Finnish)': 'Europeia (não finlandesa)', 'Finnish': 'Finlandesa', 'French Canadian': 'Franco-canadense',
  'Indigenous American': 'Indígena das Américas', 'Middle Eastern': 'Oriente Médio', 'North African': 'Norte-africana',
  'Pacific Islander': 'Ilhas do Pacífico', 'Sephardic or Mizrahi Jewish': 'Judaica sefardita ou mizrahi', 'South Asian': 'Sul-asiática',
  // Ashkenazi, age at death, test type, contralateral cancer
  'Ashkenazi Jewish ancestry': 'Ascendência judaica asquenaze', 'Age at death': 'Idade no óbito', 'e.g. 72': 'ex.: 72',
  'Test type': 'Tipo de teste', 'Panel / full gene (mutation search)': 'Painel / gene completo (busca de mutação)',
  'Targeted (known familial variant)': 'Dirigido (variante familiar conhecida)',
  'Age at contralateral diagnosis': 'Idade ao diagnóstico contralateral',
  // Genetic tests and diagnosis details
  'Genetic tests and diagnosis details': 'Testes genéticos e detalhes do diagnóstico',
  'Genetic test results': 'Resultados de testes genéticos', 'Add test result': 'Adicionar resultado de teste',
  'No test results recorded.': 'Nenhum resultado de teste registrado.', 'Diagnosis details': 'Detalhes do diagnóstico',
  'No disorders recorded. Add them under Disorders in the properties menu.': 'Nenhuma condição registrada. Adicione-as em Condições no menu de propriedades.',
  'Save': 'Salvar', 'Gene': 'Gene', 'Result': 'Resultado', 'Variant (HGVS c.)': 'Variante (HGVS c.)',
  'Protein (HGVS p.)': 'Proteína (HGVS p.)', 'Zygosity': 'Zigosidade', 'Laboratory': 'Laboratório',
  'Report date': 'Data do laudo', 'Comment': 'Comentário', 'Remove': 'Remover',
  'e.g. BRCA1': 'ex.: BRCA1', 'e.g. c.68_69del': 'ex.: c.68_69del', 'e.g. p.Glu23fs': 'ex.: p.Glu23fs', 'YYYY-MM-DD': 'AAAA-MM-DD',
  'Pathogenic': 'Patogênica', 'Likely pathogenic': 'Provavelmente patogênica',
  'Positive (class not specified)': 'Positivo (classe não informada)', 'Uncertain significance (VUS)': 'Significado incerto (VUS)',
  'Likely benign': 'Provavelmente benigna', 'Benign': 'Benigna', 'Negative (no variant found)': 'Negativo (nenhuma variante encontrada)',
  'Show under each person': 'Mostrar abaixo de cada pessoa', 'Chart': 'Heredograma', 'Diagnoses': 'Diagnósticos',
  'Phenotypes (HPO)': 'Fenótipos (HPO)', 'Genetic tests': 'Testes genéticos', 'Comments': 'Comentários',
  'Candidate genes (old files)': 'Genes candidatos (arquivos antigos)', 'Category symbols': 'Símbolos de categoria',
  'Colour by gene': 'Colorir por gene', 'Numbering (I-1, II-3)': 'Numeração (I-1, II-3)',
  "Choose how much of each individual's name to display on the pedigree chart.": 'Escolha quanto do nome de cada pessoa exibir no heredograma.',
  'Colour Individuals by Gene': 'Colorir pessoas por gene',
  'Fill the symbol of people with a positive test (and candidate genes from older files) with the gene colour, and show the gene legend.': 'Preenche o símbolo de quem tem teste positivo (e genes candidatos de arquivos antigos) com a cor do gene e mostra a legenda de genes.',
  'Candidate genes (older files):': 'Genes candidatos (arquivos antigos):',
  'Older versions stored genes without a result. Convert them to test results to record the result, variant and laboratory.': 'Versões anteriores guardavam genes sem resultado. Converta-os em resultados de teste para registrar o resultado, a variante e o laboratório.',
  'Convert to test results': 'Converter em resultados de teste', 'Search gene, e.g. BRCA1': 'Buscar gene, ex.: BRCA1',
  'in this pedigree': 'neste heredograma', 'Candidate Genes (older files)': 'Genes candidatos (arquivos antigos)',
  'Display candidate genes recorded by earlier versions, before structured test results.': 'Exibe genes candidatos registrados por versões anteriores, antes dos resultados de teste estruturados.',
  'Unknown / pending': 'Desconhecido / pendente', 'Declined testing': 'Recusou o teste', 'declined': 'recusou', 'Heterozygous': 'Heterozigoto', 'Homozygous': 'Homozigoto',
  'Hemizygous': 'Hemizigoto', 'Compound heterozygous': 'Heterozigoto composto', 'cancer': 'câncer',
  'Basis of diagnosis': 'Base do diagnóstico', 'e.g. Clinical Diagnosis': 'ex.: Clinical Diagnosis',
  'Age at diagnosis': 'Idade ao diagnóstico', 'e.g. 45': 'ex.: 45', 'e.g. 51': 'ex.: 51',
  'Breast (laterality)': 'Mama (lateralidade)', 'Histology': 'Histologia', 'Grade': 'Grau', 'Stage': 'Estadiamento',
  'Laterality': 'Lateralidade', 'New field, e.g. Ki-67': 'Novo campo, ex.: Ki-67', 'Add field': 'Adicionar campo',
  'Left': 'Esquerda', 'Right': 'Direita', 'Bilateral': 'Bilateral', 'Positive test': 'Positivo', 'Negative test': 'Negativo',
  'Equivocal': 'Equívoco', 'Not done': 'Não realizado', 'Edit…': 'Editar…', 'None recorded': 'Nenhum registro',
  'Genetic Test Results': 'Resultados de testes genéticos',
  'Display each test result (e.g. BRCA1 c.68_69del P, MSH2 −) on tested individuals.': 'Exibe cada resultado de teste (ex.: BRCA1 c.68_69del P, MSH2 −) nas pessoas testadas.',
  // Keyboard shortcuts
  'Shortcuts': 'Atalhos', 'Keyboard shortcuts': 'Atalhos de teclado', 'Tools': 'Ferramentas',
  'Person (under the mouse, or the proband)': 'Pessoa (sob o mouse, ou o probando)',
  'Add parents': 'Adicionar pais', 'Add a sibling': 'Adicionar irmão(ã)', 'Add a child': 'Adicionar filho(a)',
  'Add a partner (with a child)': 'Adicionar parceiro(a) (com um filho)',
  'Set sex: male / female / unknown': 'Definir sexo: masculino / feminino / desconhecido',
  'Toggle deceased': 'Alternar falecido', 'Open properties': 'Abrir propriedades', 'Remove person': 'Remover pessoa',
  'Close menu or dialog': 'Fechar menu ou diálogo', 'View': 'Visualização', 'Zoom in / out': 'Aumentar / diminuir zoom',
  'Center on the proband': 'Centralizar no probando', 'Pan (Shift: faster)': 'Mover a tela (Shift: mais rápido)',
  'Shortcuts are paused while you type in a field or a dialog is open.': 'Os atalhos ficam pausados enquanto você digita em um campo ou há um diálogo aberto.',
  'This shortcut works on a single person.': 'Este atalho funciona com uma pessoa individual.',
  'Already has both parents:': 'Já tem os dois pais:', 'Added parents of': 'Pais adicionados para',
  'Added a sibling of': 'Irmão(ã) adicionado(a) para', 'Added a child of': 'Filho(a) adicionado(a) para',
  'Added a partner of': 'Parceiro(a) adicionado(a) para',
  'A pregnancy cannot have children.': 'Uma gestação não pode ter filhos.',
  'A pregnancy cannot have a partner.': 'Uma gestação não pode ter parceiro(a).',
  'Marked as childless or infertile:': 'Marcado(a) como sem filhos ou infértil:',
  'Sex not allowed: a partner already has this sex.': 'Sexo não permitido: um(a) parceiro(a) já tem esse sexo.',
  'Change this life status in the properties menu.': 'Altere esse status vital no menu de propriedades.',
  'The proband cannot be removed.': 'O probando não pode ser removido.', 'Removed': 'Removido(a)',
  'the proband': 'o probando', 'male': 'masculino', 'female': 'feminino', 'unknown': 'desconhecido',
  'deceased': 'falecido', 'alive': 'vivo',
  // Start screen, draft restore and what's new
  "What's new": 'Novidades', 'Welcome to Open Pedigree X': 'Bem-vindo ao Open Pedigree X',
  'Draw and edit pedigrees in the browser. Nothing leaves your computer unless you export it.': 'Desenhe e edite heredogramas no navegador. Nada sai do seu computador, a menos que você exporte.',
  'Start from a template': 'Começar de um modelo', 'Common family structures to build on.': 'Estruturas familiares comuns para começar.',
  'Import a file': 'Importar arquivo', 'Progeny/Invitae XML, PED, GEDCOM, BOADICEA or a PDF saved here.': 'XML do Progeny/Invitae, PED, GEDCOM, BOADICEA ou um PDF salvo aqui.',
  'Generate from clinical notes': 'Gerar a partir de notas clínicas', 'Copy the instructions to an AI, paste the XML it returns.': 'Copie as instruções para uma IA e cole o XML que ela devolver.',
  'Tip: press ? at any time to see the keyboard shortcuts.': 'Dica: tecle ? a qualquer momento para ver os atalhos de teclado.',
  'Start with a blank trio': 'Começar com um trio em branco', 'Continue where you left off?': 'Continuar de onde parou?',
  'Your last pedigree was saved in this browser.': 'Seu último heredograma ficou salvo neste navegador.',
  'Untitled pedigree': 'Heredograma sem título', 'edited': 'editado', 'Start a new one': 'Começar um novo',
  'just now': 'agora há pouco', '{n} min ago': 'há {n} min', '{n} h ago': 'há {n} h', '1 day ago': 'há 1 dia', '{n} days ago': 'há {n} dias',
  'Filter by condition, test result, age, ancestry or relationship and see them highlighted on the chart.': 'Filtre por condição, resultado de teste, idade, ancestralidade ou parentesco e veja o destaque no heredograma.',
  'Cleaner cascade testing': 'Teste em cascata mais enxuto',
  'Text for the medical record in English or Portuguese, one line per relative (shortcut Y).': 'Texto para o prontuário em português ou inglês, uma linha por parente (atalho Y).',
  'Which mode of inheritance fits': 'Qual padrão de herança se ajusta',
  'Cascade testing compares dominant, recessive, X-linked, mitochondrial and Y-linked inheritance with the family and suggests the best fit.': 'O teste em cascata compara herança dominante, recessiva, ligada ao X, mitocondrial e ligada ao Y com a família e sugere a mais compatível.',
  'Cascade models per condition': 'Modelos de cascata por condição',
  'Penetrance curves, sporadic cases and settings for each condition; save a model and reuse it in other families.': 'Curvas de penetrância, casos esporádicos e parâmetros por condição; salve um modelo e use-o em outras famílias.',
  "Inbreeding coefficient (Wright's F)": 'Coeficiente de endogamia (F de Wright)',
  'Shown above consanguineous couples, in their menu and in cascade testing.': 'Mostrado acima dos casais consanguíneos, no menu do casal e no teste em cascata.',
  'PNG and copy as image': 'PNG e copiar como imagem',
  'High-resolution PNG (150 to 600 DPI) and Tools → Copy as image, ready to paste into a report.': 'PNG em alta resolução (150 a 600 DPI) e Ferramentas → Copiar como imagem, pronto para colar num relatório.',
  'Easier editing': 'Edição mais fácil',
  'Conditions, phenotypes and genes as chips; generations move apart when the text under a person grows.': 'Condições, fenótipos e genes como etiquetas; as gerações se afastam quando o texto embaixo de uma pessoa cresce.',
  'Condition names and colours': 'Nomes e cores das condições',
  'Click a condition in the legend to rename it or pick its colour; colours match Invitae.': 'Clique em uma condição na legenda para renomeá-la ou escolher a cor; as cores seguem as do Invitae.',
  'Black-and-white PDF': 'PDF em preto e branco',
  'Fill patterns tell conditions apart without colour; margins and a footer that the chart never covers.': 'Padrões de preenchimento distinguem as condições sem cor; margens e rodapé que o heredograma não cobre.',
  'Adoption and same-sex couples': 'Adoção e casais do mesmo sexo',
  'Adopted in or placed for adoption (NSGC symbols), and partners of the same sex.': 'Adotado pela família ou dado em adoção (símbolos da NSGC), e parceiros do mesmo sexo.',
  'Clearer cascade model': 'Modelo do teste em cascata mais claro',
  'One age-at-onset field (age range or penetrance curve) and conditions chosen as chips.': 'Um só campo de idade de início (faixa de idade ou curva de penetrância) e condições escolhidas como etiquetas.',
  'Pedigrees from drawings': 'Heredogramas a partir de desenhos',
  'AI instructions for photos and scans of hand-drawn pedigrees, with a check list of parents.': 'Instruções para IA ler fotos e digitalizações de heredogramas desenhados à mão, com lista de conferência dos pais.',
  'Room for long notes': 'Espaço para anotações longas',
  'Generations move apart when the text under a person grows.': 'As gerações se afastam quando o texto embaixo de uma pessoa cresce.',
  'Explanations behind (?) buttons, a one-line model summary and a shorter table.': 'Explicações nos botões (?), resumo do modelo em uma linha e tabela mais curta.',
  'Title, header and notes on the chart': 'Título, cabeçalho e notas no heredograma',
  'Family, date and author on screen and in the PDF; free-text notes on the drawing.': 'Família, data e autor na tela e no PDF; notas de texto livre no desenho.',
  'Ancestry for every person': 'Ancestralidade de cada pessoa',
  'gnomAD groups, founder populations or free text; kept in Progeny XML and used by CanRisk.': 'Grupos do gnomAD, populações fundadoras ou texto livre; mantida no XML do Progeny e usada pelo CanRisk.',
  'Better pedigrees from AI': 'Heredogramas melhores a partir da IA',
  'Clinical notes turned into XML with ages, names and comments in the right fields.': 'Notas clínicas convertidas em XML com idades, nomes e comentários nos campos certos.',
  'Draft saved in this browser': 'Rascunho salvo neste navegador', 'A reload or a closed tab no longer loses your work.': 'Recarregar a página ou fechar a aba não perde mais o trabalho.',
  // Fit of the modes of inheritance (cascade testing)
  'Fit of the modes of inheritance': 'Compatibilidade dos padrões de herança',
  'How well each mode of inheritance explains the affected and unaffected relatives (for the condition chosen in the model), the sex and phenotype of the index and the test results, using the penetrance, de novo proportion and age at onset set for each mode. Recessive assumes an affected index with two variants.': 'Quanto cada padrão de herança explica os parentes afetados e não afetados (pela condição escolhida no modelo), o sexo e o fenótipo do caso índice e os resultados de testes, usando a penetrância, a proporção de novo e a idade de início definidas para cada padrão. A recessiva considera um caso índice afetado com duas variantes.',
  'The percentages compare the modes with each other (equal weight beforehand). They are a guide for choosing the model, not a diagnosis: few relatives, unknown ages or a wrong penetrance can change them.': 'As porcentagens comparam os padrões entre si (mesmo peso de antemão). Servem de guia para escolher o modelo, não de diagnóstico: poucos parentes, idades desconhecidas ou penetrância inadequada podem alterá-las.',
  'Record affected and unaffected relatives (or test results) to compare the modes.': 'Registre parentes afetados e não afetados (ou resultados de testes) para comparar os padrões.',
  'incompatible with the pedigree': 'incompatível com o heredograma',
  'Best fit:': 'Melhor compatibilidade:', 'Use this mode': 'Usar este padrão',
  'best fit with': 'melhor ajuste com', 'women': 'mulheres',
  'De novo 1/3 does not fit: affected men have children': 'De novo 1/3 não se aplica: homens afetados têm filhos', 'Use 5%': 'Usar 5%',
  'How well each mode of inheritance explains the affected and unaffected relatives (for the condition chosen in the model), the sex and phenotype of the index and the test results. Each mode is tried over a range of penetrance, penetrance in women (X-linked: low for recessive, high for dominant) and de novo proportion, with the age at onset set for it. Recessive assumes an affected index with two variants.': 'Quanto cada padrão de herança explica os parentes afetados e não afetados (pela condição escolhida no modelo), o sexo e o fenótipo do caso índice e os resultados de testes. Cada padrão é testado numa faixa de penetrâncias, penetrância em mulheres (ligada ao X: baixa na recessiva, alta na dominante) e proporção de novo, com a idade de início definida para ele. A recessiva considera um caso índice afetado com duas variantes.',
  'The percentages compare the modes with each other (equal weight beforehand). They are a guide for choosing the model, not a diagnosis: few relatives or unknown ages can change them. Choosing a mode here also applies the settings that fit best.': 'As porcentagens comparam os padrões entre si (mesmo peso de antemão). Servem de guia para escolher o modelo, não de diagnóstico: poucos parentes ou idades desconhecidas podem alterá-las. Escolher um padrão aqui também aplica os parâmetros de melhor ajuste.',
  'Affected men have children in this family: the de novo proportion of 1/3 (Haldane) applies only when affected men do not reproduce, and it rules out daughters inheriting from their affected father. Lower it in the model (for example to 5%).': 'Nesta família há homens afetados com filhos: a proporção de novo de 1/3 (Haldane) vale só quando homens afetados não se reproduzem e impede que filhas herdem do pai afetado. Reduza-a no modelo (por exemplo, para 5%).',
  // Cascade model: relative compatibility, ascertainment, priors, phenocopy, curves, mutation ratio
  'Relative compatibility of the modes of inheritance': 'Compatibilidade relativa dos padrões de herança',
  'How well each mode of inheritance explains the affected and unaffected relatives (for the condition chosen in the model) and the test results. Each mode is tried over a range of penetrance, penetrance in women (X-linked: low for recessive, high for dominant) and de novo proportion, with the age at onset set for it. Recessive assumes an affected index with two variants.': 'Quanto cada padrão de herança explica os parentes afetados e não afetados (pela condição escolhida no modelo) e os resultados de testes. Cada padrão é testado numa faixa de penetrâncias, penetrância em mulheres (ligada ao X: baixa na recessiva, alta na dominante) e proporção de novo, com a idade de início definida para ele. A recessiva considera um caso índice afetado com duas variantes.',
  'The percentages compare the modes with each other (equal weight beforehand). They are a relative score, not a calibrated probability or a diagnosis: few relatives or unknown ages can change them. Choosing a mode here also applies the settings that fit best.': 'As porcentagens comparam os padrões entre si (mesmo peso de antemão). São um escore relativo, não uma probabilidade calibrada nem um diagnóstico: poucos parentes ou idades desconhecidas podem alterá-las. Escolher um padrão aqui também aplica os parâmetros de melhor ajuste.',
  "Ascertainment correction (recommended): the family came to attention through the affected index, so the index's phenotype only rules out settings in which it is impossible (for example no affected women), instead of favoring settings with high penetrance.": 'Correção de averiguação (recomendada): a família chegou ao serviço pelo caso índice afetado, então o fenótipo do índice só exclui os parâmetros em que ele seria impossível (por exemplo, nenhuma mulher afetada), em vez de favorecer os de penetrância alta.',
  'Correct for ascertainment through the index': 'Corrigir para averiguação pelo caso índice',
  'Approximate result': 'Resultado aproximado', 'consanguinity loop': 'laço de consanguinidade', 'search limit reached': 'limite de busca atingido',
  'With consanguinity loops, a relative whose two parents may both carry the variant is computed treating the parents as independent, which is an approximation. Very large or deep pedigrees are also searched only up to 10 generations and 512 lines of origin. Check important results with dedicated linkage software.': 'Com laços de consanguinidade, um parente cujos dois genitores podem portar a variante é calculado tratando os genitores como independentes, o que é uma aproximação. Heredogramas muito grandes ou profundos também são percorridos só até 10 gerações e 512 linhas de origem. Confira resultados importantes com software específico de ligação.',
  'Hold Ctrl (Cmd on a Mac) to choose several conditions caused by the same variant, for example breast and ovarian cancer: a relative with any of them counts as affected.': 'Segure Ctrl (Cmd no Mac) para escolher várias condições causadas pela mesma variante, por exemplo câncer de mama e de ovário: um parente com qualquer uma delas conta como afetado.',
  'e.g. 30:3 40:10 50:25 70:55': 'ex.: 30:3 40:10 50:25 70:55',
  'Penetrance by age (optional)': 'Penetrância por idade (opcional)',
  'Age range': 'Faixa de idade', 'Penetrance curve': 'Curva de penetrância', 'curve': 'curva',
  'From the penetrance curve': 'Vem da curva de penetrância', 'The penetrance curve is used instead': 'A curva de penetrância é usada no lugar',
  'Age range: carriers who become affected show signs between these ages, evenly spread (0 to 0 means at birth, congenital). Unaffected relatives younger than the range are less informative.': 'Faixa de idade: os portadores que adoecem apresentam sinais entre essas idades, distribuídos por igual (0 a 0 significa ao nascer, congênito). Parentes não afetados mais jovens que a faixa informam menos.',
  'Penetrance curve: the cumulative chance of being affected at several ages, as age:% pairs from a published curve (for example 30:3 40:10 50:25 70:55). Its last value is the lifetime penetrance, so the penetrance field follows it.': 'Curva de penetrância: a chance acumulada de estar afetado em várias idades, em pares idade:% de uma curva publicada (por exemplo 30:3 40:10 50:25 70:55). O último valor é a penetrância ao longo da vida, e o campo de penetrância passa a segui-lo.',
  'With a penetrance curve, its last value is the penetrance and the onset ages are not used.': 'Com uma curva de penetrância, o último valor dela é a penetrância e as idades de início não são usadas.',
  'Cumulative penetrance at several ages, as age:% pairs (for example 30:3 40:10 50:25 70:55 from a published curve). When filled in, it replaces the age range above to judge how informative an unaffected relative is. The lifetime penetrance is the field above.': 'Penetrância cumulativa em várias idades, em pares idade:% (por exemplo 30:3 40:10 50:25 70:55, de uma curva publicada). Quando preenchida, substitui a faixa de idade acima para avaliar quanto um parente não afetado informa. A penetrância ao longo da vida é o campo acima.',
  'Sporadic cases (% of non-carriers affected)': 'Casos esporádicos (% dos não portadores afetados)',
  'Chance that a relative without the familial variant has the condition anyway (phenocopy). Use the population risk for common conditions, for example about 12% for breast cancer in women, or turn off the use of phenotypes and rely on test results.': 'Chance de um parente sem a variante familiar ter a condição mesmo assim (fenocópia). Use o risco populacional em condições comuns, por exemplo cerca de 12% para câncer de mama em mulheres, ou desligue o uso de fenótipos e use apenas os resultados de testes.',
  'Mutation rate, male / female': 'Taxa de mutação, masculina / feminina',
  'Settings per condition': 'Parâmetros por condição', 'conditions': 'condições',
  // Model files (export / import the settings of a disease)
  'Export model': 'Exportar modelo', 'Import model': 'Importar modelo',
  'Save these settings in a file to use them in other families with the same disease': 'Salvar estes parâmetros num arquivo para usá-los em outras famílias com a mesma doença',
  'Apply the settings saved in a model file': 'Aplicar os parâmetros salvos num arquivo de modelo',
  'Name of the model:': 'Nome do modelo:',
  'Source of the values or notes (optional):': 'Fonte dos valores ou notas (opcional):',
  'This file is not a valid model:': 'Este arquivo não é um modelo válido:',
  'These conditions of the model are not in this pedigree:': 'Estas condições do modelo não estão neste heredograma:',
  'The other settings were loaded. Check the conditions used for phenotypes.': 'Os demais parâmetros foram carregados. Confira as condições usadas para os fenótipos.',
  'Penetrance (%)': 'Penetrância (%)', 'Onset from': 'Início de', 'Onset to': 'Início até', 'Sporadic cases (%)': 'Casos esporádicos (%)',
  'Each condition has its own penetrance, age at onset (or penetrance curve) and rate of sporadic cases, and the conditions count independently. Empty cells use the general values.': 'Cada condição tem sua penetrância, idade de início (ou curva de penetrância) e taxa de casos esporádicos, e as condições contam de forma independente. Células vazias usam os valores gerais.',
  'X-linked: how many times more often new variants arise in male than in female germ cells. 1 assumes equal rates (classical Haldane result, 2/3 for the mother of an isolated case). Higher values fit conditions such as hemophilia A, where most mothers of isolated cases are carriers.': 'Ligada ao X: quantas vezes mais variantes novas surgem nas células germinativas masculinas do que nas femininas. 1 supõe taxas iguais (resultado clássico de Haldane, 2/3 para a mãe de um caso isolado). Valores maiores se aplicam a condições como a hemofilia A, em que a maioria das mães de casos isolados é portadora.',
  // Wright's inbreeding coefficient
  "Inbreeding coefficient of the children (Wright's F)": 'Coeficiente de endogamia dos filhos (F de Wright)',
  'Coefficient of relationship of the couple:': 'Coeficiente de parentesco do casal:',
  'Not calculated: the common ancestors are not in the pedigree.': 'Não calculado: os ancestrais comuns não estão no heredograma.',
  'Inbreeding coefficient (F)': 'Coeficiente de endogamia (F)',
  "Write Wright's inbreeding coefficient of the children (e.g. F = 1/16 for first cousins) above the line of each consanguineous couple.": 'Mostra o coeficiente de endogamia de Wright dos filhos (ex.: F = 1/16 para primos de primeiro grau) acima da linha de cada casal consanguíneo.',
  'inbreeding coefficient of the index (parents related)': 'coeficiente de endogamia do caso índice (pais aparentados)',
  "Inbreeding coefficient of the index (Wright's F)": 'Coeficiente de endogamia do caso índice (F de Wright)',
  // Family history summary
  'Family history summary': 'Resumo da história familiar', 'Language': 'Idioma', 'Copy': 'Copiar',
  'All blood relatives': 'Todos os parentes consanguíneos',
  'List relatives without conditions': 'Listar parentes sem condições', 'Include first names': 'Incluir primeiros nomes',
  'Include the proband': 'Incluir o probando',
  'One line per relative with ages, conditions, test results and comments, ready to paste into the medical record. Review it before use.': 'Uma linha por familiar com idades, condições, resultados de testes e comentários, pronta para colar no prontuário. Revise antes de usar.',
  // PNG export and copy as image
  'Image options:': 'Opções da imagem:', 'Resolution ': 'Resolução ', 'Transparent background': 'Fundo transparente',
  'Copy as image': 'Copiar como imagem', 'Image copied to the clipboard': 'Imagem copiada para a área de transferência',
  'PNG saved': 'PNG salvo', 'reduced to fit the browser limit': 'reduzida ao limite do navegador',
  'Could not copy the image:': 'Não foi possível copiar a imagem:', 'Could not create the image:': 'Não foi possível criar a imagem:',
  'This browser cannot copy images to the clipboard.': 'Este navegador não consegue copiar imagens para a área de transferência.',
  'The image is too large to draw.': 'A imagem é grande demais para ser desenhada.',
  'The drawing could not be converted to an image.': 'Não foi possível converter o desenho em imagem.',
  // SVG export options
  'SVG export options:': 'Opções de exportação para SVG:', 'Include legend': 'Incluir legenda',
  // Pedigree header and chart notes
  'Family': 'Família', 'Title': 'Título', 'Family (name or ID)': 'Família (nome ou ID)',
  'Notes (printed at the bottom of the PDF)': 'Observações (impressas no rodapé do PDF)',
  'Pedigree information': 'Informações do heredograma', 'Title and header': 'Título e cabeçalho',
  'Shown above the chart and printed as the header and footer of the PDF.': 'Exibidas acima do heredograma e impressas no cabeçalho e no rodapé do PDF.',
  'e.g. Hereditary cancer evaluation': 'ex.: Avaliação de câncer hereditário', 'Remove header': 'Remover cabeçalho',
  'Edit the pedigree information': 'Editar as informações do heredograma',
  'Edited the pedigree information': 'Editou as informações do heredograma',
  'Removed the pedigree information': 'Removeu as informações do heredograma',
  'Add another condition…': 'Adicionar outra condição…', 'Choose a condition…': 'Escolher uma condição…',
  'Add a disorder…': 'Adicionar condição…', 'Add a phenotype…': 'Adicionar característica…', 'Add a gene…': 'Adicionar gene…',
  'Add several conditions caused by the same variant, for example breast and ovarian cancer: a relative with any of them counts as affected.': 'Adicione várias condições causadas pela mesma variante, por exemplo câncer de mama e de ovário: o parente com qualquer uma delas conta como afetado.',
  'Condition color': 'Cor da condição', 'Other color': 'Outra cor', 'Automatic color': 'Cor automática',
  'Click to change the color': 'Clique para mudar a cor', 'Rename': 'Renomear',
  'Renamed the condition': 'Renomeou a condição', 'Click to rename or change the color': 'Clique para renomear ou mudar a cor', 'Changed the color of': 'Mudou a cor de',
  'Add note on chart': 'Adicionar nota no heredograma', 'Note on the chart': 'Nota no heredograma',
  'Edit note': 'Editar nota', 'New note': 'Nova nota', 'Text shown on the chart': 'Texto exibido no heredograma',
  'Drag the note to move it. Ctrl+Enter saves.': 'Arraste a nota para movê-la. Ctrl+Enter salva.', 'Delete': 'Excluir',
  'Moved a note on the chart': 'Moveu uma nota no heredograma', 'Added a note on the chart': 'Adicionou uma nota no heredograma',
  'Removed a note from the chart': 'Removeu uma nota do heredograma', 'Edited a note on the chart': 'Editou uma nota no heredograma',
  'Include header and footer (title, family, date, author, notes)': 'Incluir cabeçalho e rodapé (título, família, data, autor, observações)',
  'Black and white (conditions drawn with fill patterns)': 'Preto e branco (condições com padrões de preenchimento)',
  // Cascade testing help
  'Help': 'Ajuda', 'Blood relatives who may share the familial variant.': 'Parentes consanguíneos que podem ter a variante familiar.',
  'Carrier frequency': 'Frequência de portadores', 'Familial variant': 'Variante familiar',
  'Population carrier frequency. Used to estimate whether both variants of a biallelic index came from one common ancestor (more likely in consanguineous families and for rare variants).': 'Frequência de portadores na população. Usada para estimar se as duas variantes de um caso índice bialélico vieram de um ancestral comum (mais provável em famílias consanguíneas e em variantes raras).',
  'Relatives younger than this are listed but not preselected. Relatives of unknown age are preselected.': 'Parentes mais novos aparecem na lista, mas não são pré-selecionados. Parentes sem idade informada são pré-selecionados.',
  'Optional. Printed in the list and the CSV. When the index has positive tests in several genes, naming the gene here selects which one is the familial variant.': 'Opcional. Aparece na lista e no CSV. Se o caso índice tiver testes positivos em vários genes, citar o gene aqui define qual é a variante familiar.',
  'Relatives with this condition count as affected, the others as unaffected (when that option is on). By default, the condition of the index person.': 'Parentes com esta condição contam como afetados e os demais como não afetados (se essa opção estiver ligada). Por padrão, a condição do caso índice.',
  'Share of carriers whose variant is new, so the parents do not carry it.': 'Proporção de portadores cuja variante é nova, ou seja, os pais não a têm.',
  'Age range in which carriers who become affected show signs. 0 to 0 means at birth (congenital). Unaffected relatives younger than the range are less informative.': 'Faixa de idade em que os portadores que adoecem apresentam sinais. 0 a 0 significa ao nascer (congênito). Parentes não afetados mais novos que a faixa são menos informativos.',
  'de novo': 'de novo', 'penetrance': 'penetrância', 'Age / status': 'Idade / status',
  // Find people (search panel)
  'Find people': 'Buscar pessoas', 'Edit search': 'Editar busca', 'Search:': 'Busca:',
  'person found': 'pessoa encontrada', 'people found': 'pessoas encontradas',
  'Quick:': 'Rápido:', 'Combine filters': 'Combinar filtros', 'all filters (AND)': 'todos os filtros (E)',
  'any filter (OR)': 'qualquer filtro (OU)', 'People who match': 'Pessoas que atendem a', 'Add filter': 'Adicionar filtro',
  'Fade the others': 'Esmaecer as demais', 'Clear': 'Limpar', 'Clinical status': 'Status clínico',
  'Condition': 'Condição', 'Any condition': 'Qualquer condição', 'any condition': 'qualquer condição',
  'at most': 'no máximo', 'at least': 'no mínimo', 'between': 'entre', 'Genetic test': 'Teste genético',
  'positive': 'positivo', 'negative': 'negativo', 'VUS': 'VUS', 'unknown / pending': 'desconhecido / pendente',
  'any result': 'qualquer resultado', 'not tested': 'não testado', 'any gene': 'qualquer gene',
  'Sex': 'Sexo', 'Life status': 'Status vital', 'blood relative of': 'parente consanguíneo de',
  'ancestor of': 'ancestral de', 'descendant of': 'descendente de', 'sibling of': 'irmão(ã) de', 'partner of': 'parceiro(a) de',
  'up to 2nd degree': 'até 2º grau', 'up to 3rd degree': 'até 3º grau', 'any degree': 'qualquer grau',
  'Phenotype (HPO)': 'Fenótipo (HPO)', 'Any phenotype': 'Qualquer fenótipo', 'Name, ID or comment': 'Nome, ID ou comentário',
  'contains': 'contém', 'does not contain': 'não contém', 'Other': 'Outro', 'Twin': 'Gemelar', 'With comments': 'Com comentários',
  'is': 'é', 'is not': 'não é', 'has': 'tem', 'does not have': 'não tem', 'and': 'e', 'or': 'ou', 'of': 'de',
  'Positive genetic test': 'Teste genético positivo', 'Diagnosed at 50 or younger': 'Diagnóstico até 50 anos',
  'Living untested relatives of the proband': 'Parentes vivos não testados do probando',
  'Ancestors of the proband': 'Ancestrais do probando', 'Filter': 'Filtro', 'Operator': 'Operador', 'Value': 'Valor',
  'Person': 'Pessoa', 'Type to search': 'Digite para buscar', 'Remove filter': 'Remover filtro',
  'Add a filter or choose a quick search.': 'Adicione um filtro ou escolha uma busca rápida.',
  'person': 'pessoa', 'people': 'pessoas', 'Nobody matches these filters.': 'Ninguém atende a esses filtros.',
  'Details': 'Detalhes',
  // Standard nomenclature, cascade testing and modification history
  'History': 'Histórico', 'Analysis': 'Análise', 'Cascade': 'Cascata',
  'Standard Nomenclature (I-1, II-3...)': 'Nomenclatura padrão (I-1, II-3...)',
  'Number generations with Roman numerals and individuals from left to right, as in clinical pedigree notation.': 'Numera as gerações em algarismos romanos e as pessoas da esquerda para a direita, como na notação clínica de heredogramas.',
  'Cascade testing': 'Teste em cascata', 'Index': 'Caso índice', 'List': 'Lista', 'Clear highlight': 'Remover destaque',
  'Blood relatives of the index person who may share the familial variant. Only untested relatives without the diagnosis are preselected: those already tested or diagnosed, deceased, unborn, not in contact or under the minimum age are listed but not preselected. Relatives of unknown age are preselected and marked.': 'Parentes consanguíneos do caso índice que podem compartilhar a variante familiar. Só são pré-selecionados os não testados e sem o diagnóstico: os já testados ou diagnosticados, falecidos, não nascidos, sem contato ou abaixo da idade mínima aparecem na lista, mas não são pré-selecionados. Parentes sem idade informada são pré-selecionados e sinalizados.',
  'Already diagnosed': 'Já diagnosticado',
  'Restore default selection': 'Restaurar seleção padrão',
  'Select again the untested, undiagnosed relatives at risk': 'Selecionar de novo os parentes em risco não testados e sem diagnóstico',
  'Adopted individuals are not counted as blood relatives of their adoptive family.': 'Pessoas adotadas não são consideradas parentes consanguíneas da família adotiva.',
  'Already tested': 'Já testado', 'Model and evidence': 'Modelo e evidências', 'Anyone marked as affected': 'Qualquer pessoa marcada como afetada',
  'Condition used for phenotypes': 'Condição usada para os fenótipos', 'De novo (% of carriers)': 'De novo (% dos portadores)',
  'Penetrance in carriers (%)': 'Penetrância nos portadores (%)', 'Penetrance in hemizygous males (%)': 'Penetrância em homens hemizigotos (%)',
  'Penetrance in biallelic individuals (%)': 'Penetrância em bialélicos (%)',
  'Penetrance in heterozygous females (%)': 'Penetrância em mulheres heterozigotas (%)',
  'Age at onset (0 to 0 = at birth)': 'Idade de início (0 a 0 = ao nascer)', 'to': 'a', 'years': 'anos',
  'Use phenotypes of relatives': 'Usar fenótipos dos parentes',
  'Relatives without the condition recorded are unaffected': 'Parentes sem a condição registrada são não afetados',
  'Use test results (+ / −) and carrier marks': 'Usar resultados de teste (+ / −) e marcas de portador',
  'De novo examples: about 1/3 of isolated males for lethal X-linked conditions (Haldane); about 50% in NF1; about 80% in achondroplasia; rare in late-onset cancer syndromes.': 'Exemplos de de novo: cerca de 1/3 dos homens isolados em condições ligadas ao X letais (Haldane); cerca de 50% na NF1; cerca de 80% na acondroplasia; raro em síndromes de câncer de início tardio.',
  'Chances follow the selected mode of inheritance through the pedigree and are updated with the phenotypes and test results recorded in it, using the model below. Review the de novo proportion and penetrance for the condition.': 'As chances seguem o modo de herança selecionado pelo heredograma e são atualizadas com os fenótipos e resultados de teste registrados nele, conforme o modelo abaixo. Revise a proporção de novo e a penetrância para a condição.',
  'chance the variant arose de novo in the index': 'de chance de a variante ter surgido de novo no caso índice',
  'Evidence:': 'Evidências:', 'affected': 'afetados', 'unaffected': 'não afetados', 'tested': 'testados',
  'The recorded phenotypes and test results contradict each other under this mode of inheritance.': 'Os fenótipos e resultados de teste registrados se contradizem neste modo de herança.',
  'Penetrance': 'Penetrância', 'in heterozygous females': 'em mulheres heterozigotas', 'Age at onset': 'Idade de início',
  'Inheritance': 'Herança', 'Index genotype': 'Genótipo do caso índice',
  'Population carrier frequency': 'Frequência de portadores na população', '1 in': '1 em',
  'chance both variants come from one common ancestor': 'de chance de as duas variantes virem de um ancestral comum',
  'Autosomal dominant': 'Autossômica dominante', 'Autosomal recessive': 'Autossômica recessiva',
  'X-linked recessive': 'Recessiva ligada ao X', 'X-linked dominant': 'Dominante ligada ao X',
  'Mitochondrial': 'Mitocondrial', 'Y-linked': 'Ligada ao Y',
  'One variant (heterozygous carrier)': 'Uma variante (portador heterozigoto)',
  'Two variants (biallelic, affected)': 'Duas variantes (bialélico, afetado)',
  'Chances are prior risks that follow the selected mode of inheritance through the pedigree. They assume no de novo variants and do not take into account results or phenotypes of other relatives.': 'As chances são riscos a priori calculados seguindo o modo de herança selecionado pelo heredograma. Elas pressupõem ausência de variantes de novo e não consideram resultados ou fenótipos de outros parentes.',
  'Y-linked variants are only carried by males: choose a male index person.': 'Variantes ligadas ao Y só ocorrem em homens: escolha um caso índice do sexo masculino.',
  'at risk': 'em risco', 'not at risk with this inheritance': 'sem risco nesta herança',
  'No relatives at risk within the selected degree. Add parents, siblings or children to the index person, or check the mode of inheritance.': 'Nenhum parente em risco no grau selecionado. Adicione pais, irmãos ou filhos ao caso índice ou confira o modo de herança.',
  'Carrier': 'Portador', 'If positive': 'Se positivo',
  'Chance of carrying the variant': 'Chance de ter a variante', 'Chance of being a carrier': 'Chance de ser portador',
  'Chance of being affected': 'Chance de ser afetado',
  'Obligate carrier': 'Portador obrigatório', 'Obligate biallelic': 'Bialélico obrigatório',
  'At risk of the condition': 'Em risco para a condição',
  'Heterozygous carrier (usually unaffected)': 'Portador heterozigoto (geralmente não afetado)',
  'Hemizygous: affected': 'Hemizigoto: afetado',
  'Heterozygous carrier (may have mild signs)': 'Portadora heterozigota (pode ter sinais leves)',
  'Affected if male, carrier if female': 'Afetado se homem, portadora se mulher',
  'Heterozygous: at risk (often milder)': 'Heterozigota: em risco (geralmente mais leve)',
  'At risk (variable, heteroplasmy); does not transmit': 'Em risco (variável, heteroplasmia); não transmite',
  'At risk (variable, heteroplasmy); transmits to all children': 'Em risco (variável, heteroplasmia); transmite a todos os filhos',
  'Hemizygous: at risk; transmits to all sons': 'Hemizigoto: em risco; transmite a todos os filhos homens',
  'Carrier if one variant, affected if both': 'Portador se uma variante, afetado se as duas',
  'Index person': 'Caso índice', 'Relatives': 'Parentes', 'Minimum age': 'Idade mínima',
  'Familial variant or condition (optional)': 'Variante ou condição familiar (opcional)',
  'Familial variant or condition': 'Variante ou condição familiar',
  'e.g. BRCA2 c.5946del': 'ex.: BRCA2 c.5946del',
  'First-degree relatives': 'Parentes de 1º grau', 'Up to 2nd degree': 'Até 2º grau', 'Up to 3rd degree': 'Até 3º grau',
  'listed': 'listados', 'selected to approach': 'selecionados para contato', 'already tested': 'já testados',
  'No blood relatives found within the selected degree. Add parents, siblings or children to the index person.': 'Nenhum parente consanguíneo encontrado no grau selecionado. Adicione pais, irmãos ou filhos ao caso índice.',
  'ID': 'ID', 'Relationship': 'Parentesco', 'Degree': 'Grau', 'Chance': 'Chance', 'Age': 'Idade', 'Status': 'Status',
  'Results': 'Resultados', 'Note': 'Observação', 'Approach': 'Contatar', 'Chance of sharing variant': 'Chance de compartilhar a variante',
  'Approach this relative': 'Contatar este parente', 'Show on chart': 'Mostrar no heredograma',
  'Highlight on chart': 'Destacar no heredograma', 'Export CSV': 'Exportar CSV', 'Copy list': 'Copiar lista',
  'Could not copy automatically. Please use Export CSV instead.': 'Não foi possível copiar automaticamente. Use Exportar CSV.',
  'Unborn': 'Não nascido', 'Deceased': 'Falecido', 'Not in contact': 'Sem contato', 'Unknown age': 'Idade desconhecida',
  'Under minimum age': 'Abaixo da idade mínima', 'Alive': 'Vivo', 'Stillborn': 'Natimorto', 'Miscarriage': 'Aborto espontâneo',
  'Aborted': 'Aborto induzido', 'Carrier': 'Portador', 'Affected': 'Afetado', 'Pre-symptomatic': 'Pré-sintomático',
  'Tested positive (+)': 'Testado positivo (+)', 'Tested negative (−)': 'Testado negativo (−)',
  'Documented evaluation (*)': 'Avaliação documentada (*)',
  '1st degree': '1º grau', '2nd degree': '2º grau', '3rd degree': '3º grau',
  'Proband': 'Probando', 'Unnamed': 'Sem nome', 'Yes': 'Sim', 'No': 'Não', 'Date': 'Data',
  'Modification history': 'Histórico de modificações',
  'Timeline of changes made in this session. Restore any earlier version still available; restoring is also recorded.': 'Linha do tempo das alterações feitas nesta sessão. Restaure qualquer versão anterior ainda disponível; a restauração também fica registrada.',
  'Your name or initials (recorded with each change)': 'Seu nome ou iniciais (registrado em cada alteração)',
  'e.g. FP': 'ex.: FP', 'Export log (CSV)': 'Exportar registro (CSV)', 'No changes yet.': 'Nenhuma alteração ainda.',
  'Current': 'Atual', 'Restore': 'Restaurar', 'Time': 'Hora', 'Author': 'Autor', 'Action': 'Ação', 'Change': 'Alteração',
  'change': 'alteração', 'undo': 'desfazer', 'redo': 'refazer', 'restore': 'restauração',
  'Info': 'Informações', 'Output': 'Saída', 'Load': 'Carregar', 'Edit': 'Editar', 'Reset': 'Redefinir',
  'Unsuported browser mode': 'Modo de navegador não compatível', 'Export': 'Exportar', 'Close': 'Fechar',
  'Open XML': 'Abrir XML', 'Save XML': 'Salvar XML', 'Rename XML': 'Renomear XML', 'Templates': 'Modelos',
  'Import': 'Importar', 'Undo': 'Desfazer', 'Redo': 'Refazer', 'Re-layout': 'Reorganizar',
  'Labels': 'Rótulos', 'Clear all': 'Limpar tudo', 'Menu': 'Menu', 'Google Drive': 'Google Drive',
  'Based on ': 'Baseado no ', ' by PhenoTips': ' da PhenoTips',
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
  'Treat non-standard phenotype values as new disorders': 'Tratar valores de fenótipo fora do padrão como novas condições',
  "Mark all patients with known disorder status with 'documented evaluation' mark": "Marcar todos os pacientes com estado da condição conhecido como 'avaliação documentada'",
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
  'This person already has the specified disorder': 'Esta pessoa já tem a condição especificada',
  "This person doesn't have the specified disorder": 'Esta pessoa não tem a condição especificada',
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
  , 'Make this person a twin of an existing sibling': 'Tornar esta pessoa gêmea de um irmão já existente'
  , 'No children': 'Sem filhos', 'Multiple': 'Múltiplos', 'Twins': 'Gêmeos', 'Infertile': 'Infértil'
  , 'Mark as childless by choice': 'Marcar como sem filhos por opção', 'Mark as infertile': 'Marcar como infértil'
  , 'Choose which information to display directly in the label box below individuals:': 'Escolha quais informações exibir diretamente no rótulo abaixo das pessoas:'
  , 'Diagnoses (Disorders)': 'Diagnósticos (condições)'
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
  , 'To edit: upload PDF to OPX.': 'Para editar: envie o PDF para o OPX.'
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
  , 'Disorders': 'Condições', 'Genes': 'Genes', 'Phenotypic features': 'Características fenotípicas'
  , 'Age': 'Idade', 'e.g. 44, 4 mo, 3 wk': 'ex.: 44, 4 meses, 3 semanas'
  , 'Date of birth': 'Data de nascimento', 'Date of death': 'Data do óbito', 'Individual is': 'O indivíduo está'
  , 'Alive': 'Vivo', 'Stillborn': 'Natimorto', 'Deceased': 'Falecido', 'Miscarriage': 'Aborto espontâneo'
  , 'Unborn': 'Não nascido', 'Aborted': 'Aborto induzido', 'Gestation age': 'Idade gestacional'
  , 'Heredity options': 'Opções reprodutivas', 'None': 'Nenhum', 'Childless': 'Sem filhos', 'Adopted': 'Adotado',
  'Adoption': 'Adoção', 'Not adopted': 'Não adotado', 'Adopted in': 'Adotado pela família', 'Placed for adoption': 'Dado em adoção'
  , 'Monozygotic twin': 'Gêmeo monozigótico', 'Twin of': 'Gêmeo de', 'Not a twin': 'Não é gêmeo'
  , 'Sister': 'Irmã', 'Brother': 'Irmão', 'Sibling': 'Irmão(ã)','Not in contact with proband': 'Sem contato com o probando'
  , 'Proband': 'Probando', 'Placeholder node': 'Pessoa fictícia', 'Comments': 'Comentários'
  , 'Number of persons in this group': 'Número de pessoas neste grupo', 'Identifier(s)': 'Identificador(es)'
  , 'Known disorders': 'Condições conhecidas', '(common to all individuals in the group)': '(comuns a todas as pessoas do grupo)'
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
  , 'Diagnoses (Disorders)': 'Diagnósticos (condições)'
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
  , 'To edit: upload PDF to OPX.': 'Para editar: envie o PDF para o OPX.'
  , 'has multiple children. Please select which children are shared with this partner:': 'tem vários filhos. Selecione quais filhos são deste parceiro:'
  , 'Generate pedigree XML from clinical notes': 'Gerar heredograma XML de notas clínicas'
  , 'Use these instructions with de-identified notes in an institution-approved AI, then paste the XML above.': 'Use as instruções com dados desidentificados em uma IA aprovada pela instituição; depois, cole o XML acima.'
};

export function getLanguage() {
  var pageLanguage = document.documentElement.getAttribute('lang') || 'en';
  return pageLanguage.toLowerCase().indexOf('pt') === 0 ? 'pt-BR' : 'en';
}

/** Portuguese text for a key whatever the page language (for documents written in Portuguese) */
export function toPortuguese(text) {
  return (text && translations[text]) || text;
}

export function translate(text) {
  if (getLanguage() !== 'pt-BR' || !text) return text;
  var exact = translations[text];
  if (exact) return exact;
  // Translate known fragments in interpolated status and error messages.
  return Object.keys(translations).filter(function(key) { return key.length > 8 && text.indexOf(key) !== -1; })
    .reduce(function(result, key) { return result.split(key).join(translations[key]); }, text);
}

// Text typed by the user (pedigree header, chart notes) is marked data-no-translate
var isUserText = function(el) {
  return !!(el && el.closest && el.closest('[data-no-translate]'));
};

function translateNode(node) {
  if (!node) return;
  if (node.nodeType === 3) {
    if (isUserText(node.parentElement)) return;
    var translated = translate(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
    return;
  }
  if (node.nodeType !== 1 && node.nodeType !== 9) return;
  if (node.nodeType === 1 && node.hasAttribute('data-no-translate')) return;
  if (node.nodeType === 1) {
    // "value" is visible text only on buttons; on radios, checkboxes, options and text fields it
    // is data (e.g. "alive", "Left", "Positive test") and must never be translated
    var valueIsText = node.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(node.getAttribute('type') || '');
    ['title', 'aria-label', 'placeholder', 'value'].forEach(function(attribute) {
      if (attribute === 'value' && !valueIsText) {
        return;
      }
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
