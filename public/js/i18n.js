const LANG_KEY = 'orlo_lang';
export const LANGS = ['en', 'pt'];
const LOCALES = { en: 'en-IE', pt: 'pt-PT' };

const STRINGS = {
  en: {
    'meta.store': 'Store',
    'meta.lab': 'Lab',
    'meta.evaluation': 'Evaluation',
    'meta.product': 'Product',
    'nav.store': 'Store',
    'nav.lab': 'Lab',
    'nav.evaluation': 'Evaluation',
    'nav.skip': 'Skip to content',
    'nav.main': 'Main',
    'lang.label': 'Language',
    'brand.tag': 'Recommender',

    'footer.note': 'Fictional store and synthetic data. Built as a portfolio project; nothing is sold.',
    'footer.privacy': 'Your browsing stays in this tab. This app stores nothing about you.',
    'footer.code': 'Source code',
    'footer.journey': 'Visitor Journey Dashboard',

    'home.eyebrow': 'Explainable recommendations',
    'home.title': 'A store that shows its reasoning.',
    'home.text':
      'Open a few products and watch the suggestions change. Every suggestion says why it is there and how much each model contributed.',
    'home.cta': 'Start browsing',
    'home.lab': 'Open the lab',
    'home.forYou': 'Recommended for you',
    'home.popular': 'Popular right now',
    'home.popularHint': 'You have not opened anything yet, so everyone sees the same best sellers.',
    'home.personalHintOne': 'Based on the product you opened.',
    'home.personalHint': 'Based on the {count} products you opened.',
    'home.catalogue': 'The collection',
    'home.count': '{count} products, in three colours each',

    'category.all': 'All',
    'category.shirts': 'Shirts',
    'category.polos': 'Polos',
    'category.knitwear': 'Knitwear',
    'category.trousers': 'Trousers',
    'category.outerwear': 'Outerwear',
    'category.accessories': 'Accessories',

    'history.title': 'Your browsing',
    'history.empty': 'Nothing yet.',
    'history.clear': 'Clear',
    'history.note': 'Kept in this tab only, and sent just to calculate suggestions.',
    'history.view': 'viewed',
    'history.cart': 'in bag',

    'product.back': 'Back to the collection',
    'product.add': 'Add to bag',
    'product.added': 'Added to the demo bag. Stronger signal recorded.',
    'product.demo': 'Demo only: this records a stronger signal and buys nothing.',
    'product.similar': 'You may also like',
    'product.look': 'Complete the look',
    'product.notFound': 'Product not found.',
    'product.sale': 'Sale',
    'product.new': 'New',
    'product.style': 'Style',
    'product.material': 'Material',
    'product.season': 'Season',
    'product.palette': 'Palette',
    'product.colours': 'Also available in',

    'reason.collaborative': 'Simulated visitors interested in {product} also looked at this',
    'reason.content': 'Shares {attributes} with {product}',
    'reason.contentPlain': 'Similar to {product}',
    'reason.popularity': 'Popular in the store',
    'reason.complement': 'Goes with {product}',
    'reason.complementShared': 'Goes with {product}, and shares {attributes}',
    'attribute.style': 'style',
    'attribute.material': 'material',
    'attribute.season': 'season',
    'attribute.palette': 'palette',
    'list.and': 'and',

    'share.collaborative': 'Behaviour',
    'share.content': 'Similarity',
    'share.popularity': 'Popularity',
    'share.label': 'Contribution of each model to this suggestion',

    'lab.eyebrow': 'Lab',
    'lab.title': 'Change the model, see the list change.',
    'lab.text':
      'Move the weights or start from a sample visitor. The list updates straight away, using the same model as the store. Popularity only serves visitors with no history.',
    'lab.visitors': 'Sample visitors',
    'lab.visitor.new': 'New visitor',
    'lab.visitor.heritage': 'Heritage',
    'lab.visitor.coastal': 'Coastal',
    'lab.visitor.tailored': 'Tailored',
    'lab.weights': 'Model weights',
    'lab.collaborative': 'Behaviour',
    'lab.collaborativeHint': 'What people with similar interests looked at',
    'lab.content': 'Similarity',
    'lab.contentHint': 'Shared style, material, season and palette',
    'lab.diversity': 'Diversity',
    'lab.diversityHint': 'Trades relevance for more varied suggestions',
    'lab.reset': 'Reset to tuned values',
    'lab.tuned': 'Tuned values: {collaborative} behaviour, {content} similarity.',
    'lab.results': 'Suggestions',
    'lab.zero': 'At least one weight must be above 0.',
    'lab.score': 'Score {score}',

    'eval.eyebrow': 'Evaluation',
    'eval.title': 'Does it work, and how do we know?',
    'eval.text':
      'The task: a visitor opens a product. Predict which different products they look at next in that session, from what they did before.',
    'eval.fact.lists': 'test lists',
    'eval.fact.visitors': 'visitors',
    'eval.fact.events': 'training events per dataset',
    'eval.headline':
      'Across {datasets} simulated datasets, the hybrid found about {ratio}× more of what visitors view next than best sellers from the same category ({min}× to {max}×).',
    'eval.comparison': 'How each approach compares',
    'eval.ranker': 'Approach',
    'eval.recall': 'Recall@4',
    'eval.recallHint': 'Share of the next products found among the four shown',
    'eval.ndcg': 'NDCG@10',
    'eval.ndcgHint': 'Ranking quality: a hit near the top counts for more',
    'eval.coverage': 'Coverage',
    'eval.coverageHint': 'Share of the catalogue ever shown',
    'eval.ranker.random': 'Random',
    'eval.ranker.popularity': 'Popularity',
    'eval.ranker.same_category': 'Same category first (Visitor Journey rule)',
    'eval.ranker.same_category_popular': 'Same category, best sellers first',
    'eval.ranker.content': 'Similarity only',
    'eval.ranker.collaborative': 'Behaviour only',
    'eval.ranker.hybrid': 'Hybrid',
    'eval.lift': 'Is the difference real?',
    'eval.liftText': 'NDCG@10 gain of the hybrid on the same lists, with a 95% confidence interval.',
    'eval.liftInterval': '{low} to {high}',
    'eval.liftAhead': 'ahead in {count} of {total} datasets',
    'eval.tie': 'Tie',
    'eval.fact.datasets': 'test datasets',
    'eval.reach': 'What the hybrid adds',
    'eval.reachText':
      'Against behaviour alone, the hybrid ranks better, with more varied lists and more new products reached. Its coverage is lower, because it follows price and season.',
    'eval.reach.metric': 'Measure',
    'eval.reach.new': 'Recall@10 on new products',
    'eval.reach.coverage': 'Catalogue coverage',
    'eval.reach.diversity': 'Diversity of the four shown',
    'eval.colours': 'The rule on other colours',
    'eval.coloursText':
      'Suggestions leave out other colours of anything already seen, because the same jacket in brown is a poor suggestion. Since those products are never shown, these results do not count them as hits. If they did, hiding them would lower NDCG@10 from {with} to {without}.',
    'eval.next': 'Next step: a live test',
    'eval.nextText':
      'Offline results cannot show that visitors prefer these suggestions. Assuming an {baseline} add-to-bag rate, detecting a 10% lift needs about {visitors} visitors per group.',
    'eval.nextLink': 'Read the experiment plan',
    'eval.control': 'Control test',
    'eval.controlText':
      'Shuffling the training data keeps popularity but destroys who liked what. If the behaviour model is learning something real, its score must fall to the level of popularity.',
    'eval.control.real': 'Behaviour model, real data',
    'eval.control.shuffled': 'Behaviour model, shuffled data',
    'eval.control.popularity': 'Popularity',
    'eval.look': 'Complete the look',
    'eval.lookText':
      'At least one of the four suggestions matched the rest of the basket in {complements} of {cases} baskets, against {popular} for popular products from other categories.',
    'eval.method': 'How it was tested',
    'eval.method.1':
      'Weights were tuned on one dataset. These results come from ten others, with their own seeds, evaluated once after tuning ended.',
    'eval.method.2':
      'The model trains only on events before a single cutoff, so it never sees anyone’s future.',
    'eval.method.3': 'Intervals come from a bootstrap that resamples whole visitors.',
    'eval.limits': 'What these numbers do not show',
    'eval.limit.1':
      'The main results use synthetic data that I generated, so they show the system and the comparison work. They do not predict sales in a real store. The real purchases come from a different kind of shop.',
    'eval.limit.2':
      'New products remain weak: recall@10 of {hybrid}, against {rule} for showing the same category first.',
    'eval.limit.3': 'The measure is the next view, not purchases or revenue.',

    'error.load': 'Could not load this. Please try again in a moment.',
    'error.retry': 'Try again',
    'why.also': 'Also:',
    'why.inSeason': 'in season',
    'product.colour': 'Colour',
    'lab.margin': 'Margin priority',
    'lab.marginHint': 'Favours higher-margin products. A small weight is on by default.',
    'lab.marginValue': 'Margin {margin}',
    'eval.realTitle': 'Test on real purchases',
    'eval.realText':
      'The same models also ran on {orders} real orders from {customers} customers of a UK online gift retailer (Online Retail II, CC BY 4.0). They predict the rest of an order from its first product and the customer history, without the diversity, season or margin rules. This is not a fashion store, so the result shows whether the method works on real behaviour, not what Orlo would achieve.',
    'eval.realFinding':
      'The hybrid also came first here: NDCG@10 of {hybrid}, against {behaviour} for behaviour alone (gain of {gain}, interval {low} to {high}) and {popularity} for popularity. The control test held too: with shuffled orders, behaviour fell to {shuffled}.',
    'eval.realLists': '{cases} test orders, {products} products',
    'eval.business': 'Price, season and margin',
    'eval.businessText':
      'Suggestions favour the visitor’s usual price level, what is in season and, slightly, products with a higher margin. Each adjustment was kept only as far as it cost under 1% of accuracy on the tuning data. Average margin of the four shown: {with}, against {without} with no diversity or margin rules.',
    'state.loading': 'Loading…',
  },
  pt: {
    'meta.store': 'Loja',
    'meta.lab': 'Laboratório',
    'meta.evaluation': 'Avaliação',
    'meta.product': 'Produto',
    'nav.store': 'Loja',
    'nav.lab': 'Laboratório',
    'nav.evaluation': 'Avaliação',
    'nav.skip': 'Saltar para o conteúdo',
    'nav.main': 'Principal',
    'lang.label': 'Idioma',
    'brand.tag': 'Recommender',

    'footer.note': 'Loja fictícia e dados sintéticos. Projeto de portfólio: nada é vendido.',
    'footer.privacy': 'A tua navegação fica neste separador. Esta aplicação não guarda nada sobre ti.',
    'footer.code': 'Código-fonte',
    'footer.journey': 'Visitor Journey Dashboard',

    'home.eyebrow': 'Recomendações explicáveis',
    'home.title': 'Uma loja que mostra o seu raciocínio.',
    'home.text':
      'Abre alguns produtos e vê as sugestões mudarem. Cada sugestão diz porque está ali e quanto contribuiu cada modelo.',
    'home.cta': 'Começar a explorar',
    'home.lab': 'Abrir o laboratório',
    'home.forYou': 'Recomendado para ti',
    'home.popular': 'Mais populares agora',
    'home.popularHint': 'Ainda não abriste nada, por isso toda a gente vê os mesmos mais vendidos.',
    'home.personalHintOne': 'Com base no produto que abriste.',
    'home.personalHint': 'Com base nos {count} produtos que abriste.',
    'home.catalogue': 'A coleção',
    'home.count': '{count} produtos, em três cores cada',

    'category.all': 'Tudo',
    'category.shirts': 'Camisas',
    'category.polos': 'Polos',
    'category.knitwear': 'Malhas',
    'category.trousers': 'Calças',
    'category.outerwear': 'Casacos',
    'category.accessories': 'Acessórios',

    'history.title': 'A tua navegação',
    'history.empty': 'Ainda nada.',
    'history.clear': 'Limpar',
    'history.note': 'Fica só neste separador e é enviada apenas para calcular sugestões.',
    'history.view': 'visto',
    'history.cart': 'no saco',

    'product.back': 'Voltar à coleção',
    'product.add': 'Adicionar ao saco',
    'product.added': 'Adicionado ao saco de demonstração. Registado um sinal mais forte.',
    'product.demo': 'Só para demonstração: regista um sinal mais forte e não compra nada.',
    'product.similar': 'Também podes gostar',
    'product.look': 'Completa o look',
    'product.notFound': 'Produto não encontrado.',
    'product.sale': 'Promoção',
    'product.new': 'Novo',
    'product.style': 'Estilo',
    'product.material': 'Material',
    'product.season': 'Estação',
    'product.palette': 'Paleta',
    'product.colours': 'Também disponível em',

    'reason.collaborative': 'Visitantes simulados interessados em {product} também viram isto',
    'reason.content': 'Partilha {attributes} com {product}',
    'reason.contentPlain': 'Semelhante a {product}',
    'reason.popularity': 'Popular na loja',
    'reason.complement': 'Combina com {product}',
    'reason.complementShared': 'Combina com {product} e partilha {attributes}',
    'attribute.style': 'estilo',
    'attribute.material': 'material',
    'attribute.season': 'estação',
    'attribute.palette': 'paleta',
    'list.and': 'e',

    'share.collaborative': 'Comportamento',
    'share.content': 'Semelhança',
    'share.popularity': 'Popularidade',
    'share.label': 'Contribuição de cada modelo para esta sugestão',

    'lab.eyebrow': 'Laboratório',
    'lab.title': 'Muda o modelo e vê a lista mudar.',
    'lab.text':
      'Ajusta os pesos ou começa por um visitante de exemplo. A lista atualiza logo, com o mesmo modelo da loja. A popularidade só serve quem ainda não tem histórico.',
    'lab.visitors': 'Visitantes de exemplo',
    'lab.visitor.new': 'Visitante novo',
    'lab.visitor.heritage': 'Heritage',
    'lab.visitor.coastal': 'Costeiro',
    'lab.visitor.tailored': 'Alfaiataria',
    'lab.weights': 'Pesos do modelo',
    'lab.collaborative': 'Comportamento',
    'lab.collaborativeHint': 'O que viram pessoas com interesses parecidos',
    'lab.content': 'Semelhança',
    'lab.contentHint': 'Estilo, material, estação e paleta em comum',
    'lab.diversity': 'Diversidade',
    'lab.diversityHint': 'Troca relevância por sugestões mais variadas',
    'lab.reset': 'Repor valores afinados',
    'lab.tuned': 'Valores afinados: {collaborative} comportamento, {content} semelhança.',
    'lab.results': 'Sugestões',
    'lab.zero': 'Pelo menos um peso tem de ser superior a 0.',
    'lab.score': 'Pontuação {score}',

    'eval.eyebrow': 'Avaliação',
    'eval.title': 'Funciona? E como sabemos?',
    'eval.text':
      'A tarefa: um visitante abre um produto. Prever que outros produtos, diferentes, vê a seguir nessa sessão, a partir do que fez antes.',
    'eval.fact.lists': 'listas de teste',
    'eval.fact.visitors': 'visitantes',
    'eval.fact.events': 'eventos de treino por conjunto',
    'eval.headline':
      'Em {datasets} conjuntos de dados simulados, o híbrido encontrou cerca de {ratio}× mais do que os visitantes veem a seguir do que os mais vendidos da mesma categoria (entre {min}× e {max}×).',
    'eval.comparison': 'Como se compara cada abordagem',
    'eval.ranker': 'Abordagem',
    'eval.recall': 'Recall@4',
    'eval.recallHint': 'Parte dos produtos seguintes encontrada nos quatro mostrados',
    'eval.ndcg': 'NDCG@10',
    'eval.ndcgHint': 'Qualidade da ordem: um acerto perto do topo vale mais',
    'eval.coverage': 'Cobertura',
    'eval.coverageHint': 'Parte do catálogo que chega a ser mostrada',
    'eval.ranker.random': 'Aleatório',
    'eval.ranker.popularity': 'Popularidade',
    'eval.ranker.same_category': 'Mesma categoria primeiro (regra do Visitor Journey)',
    'eval.ranker.same_category_popular': 'Mesma categoria, mais vendidos primeiro',
    'eval.ranker.content': 'Só semelhança',
    'eval.ranker.collaborative': 'Só comportamento',
    'eval.ranker.hybrid': 'Híbrido',
    'eval.lift': 'A diferença é real?',
    'eval.liftText': 'Ganho de NDCG@10 do híbrido nas mesmas listas, com intervalo de confiança de 95%.',
    'eval.liftInterval': '{low} a {high}',
    'eval.liftAhead': 'à frente em {count} de {total} conjuntos',
    'eval.tie': 'Empate',
    'eval.fact.datasets': 'conjuntos de teste',
    'eval.reach': 'O que o híbrido acrescenta',
    'eval.reachText':
      'Contra o comportamento sozinho, o híbrido ordena melhor, com listas mais variadas e mais produtos novos alcançados. A cobertura é menor, porque segue o preço e a estação.',
    'eval.reach.metric': 'Medida',
    'eval.reach.new': 'Recall@10 em produtos novos',
    'eval.reach.coverage': 'Cobertura do catálogo',
    'eval.reach.diversity': 'Diversidade dos quatro mostrados',
    'eval.colours': 'A regra das outras cores',
    'eval.coloursText':
      'As sugestões deixam de fora outras cores do que já foi visto, porque o mesmo casaco em castanho é uma má sugestão. Como esses produtos nunca são mostrados, estes resultados não os contam como acertos. Se contassem, escondê-los baixaria o NDCG@10 de {with} para {without}.',
    'eval.next': 'Próximo passo: um teste real',
    'eval.nextText':
      'Os resultados offline não mostram que os visitantes preferem estas sugestões. Assumindo uma taxa de {baseline} de adição ao saco, detetar uma subida de 10% exige cerca de {visitors} visitantes por grupo.',
    'eval.nextLink': 'Ler o plano de experiência',
    'eval.control': 'Teste de controlo',
    'eval.controlText':
      'Baralhar os dados de treino mantém a popularidade, mas destrói quem gostou de quê. Se o modelo de comportamento aprende algo real, a pontuação tem de cair para o nível da popularidade.',
    'eval.control.real': 'Modelo de comportamento, dados reais',
    'eval.control.shuffled': 'Modelo de comportamento, dados baralhados',
    'eval.control.popularity': 'Popularidade',
    'eval.look': 'Completa o look',
    'eval.lookText':
      'Pelo menos uma das quatro sugestões coincidiu com o resto do cesto em {complements} de {cases} cestos, contra {popular} das peças populares de outras categorias.',
    'eval.method': 'Como foi testado',
    'eval.method.1':
      'Os pesos foram afinados num conjunto de dados. Estes resultados vêm de outros dez, com seeds próprias, avaliados uma vez depois de terminada a afinação.',
    'eval.method.2':
      'O modelo treina só com eventos anteriores a um único corte, por isso nunca vê o futuro de ninguém.',
    'eval.method.3': 'Os intervalos vêm de um bootstrap que reamostra visitantes inteiros.',
    'eval.limits': 'O que estes números não mostram',
    'eval.limit.1':
      'Os resultados principais usam dados sintéticos gerados por mim, por isso mostram que o sistema e a comparação funcionam, mas não preveem vendas numa loja real. As compras reais vêm de outro tipo de loja.',
    'eval.limit.2':
      'Os produtos novos continuam fracos: recall@10 de {hybrid}, contra {rule} ao mostrar primeiro a mesma categoria.',
    'eval.limit.3': 'A medida é a visualização seguinte, não compras nem receita.',

    'error.load': 'Não foi possível carregar. Tenta novamente daqui a pouco.',
    'error.retry': 'Tentar novamente',
    'why.also': 'Também:',
    'why.inSeason': 'da estação',
    'product.colour': 'Cor',
    'lab.margin': 'Prioridade à margem',
    'lab.marginHint': 'Favorece produtos com mais margem. Um peso pequeno está ligado por omissão.',
    'lab.marginValue': 'Margem {margin}',
    'eval.realTitle': 'Teste com compras reais',
    'eval.realText':
      'Os mesmos modelos correram também em {orders} encomendas reais de {customers} clientes de um retalhista online britânico de presentes (Online Retail II, CC BY 4.0). Preveem o resto de uma encomenda a partir do primeiro produto e do histórico do cliente, sem as regras de diversidade, estação ou margem. Não é uma loja de moda, por isso o resultado mostra se o método funciona com comportamento real, não o que a Orlo alcançaria.',
    'eval.realFinding':
      'O híbrido ficou também em primeiro: NDCG@10 de {hybrid}, contra {behaviour} só com comportamento (ganho de {gain}, intervalo de {low} a {high}) e {popularity} com popularidade. O teste de controlo também se confirmou: com encomendas baralhadas, o comportamento caiu para {shuffled}.',
    'eval.realLists': '{cases} encomendas de teste, {products} produtos',
    'eval.business': 'Preço, estação e margem',
    'eval.businessText':
      'As sugestões favorecem o nível de preço habitual do visitante, o que é da estação e, ligeiramente, produtos com mais margem. Cada ajuste só foi mantido enquanto custasse menos de 1% de precisão nos dados de afinação. Margem média dos quatro mostrados: {with}, contra {without} sem regras de diversidade ou margem.',
    'state.loading': 'A carregar…',
  },
};

// Catalogue vocabulary, kept apart from the interface copy.
const ATTRIBUTE_VALUES = {
  en: {
    tailored: 'Tailored',
    smart_casual: 'Smart casual',
    heritage: 'Heritage',
    coastal: 'Coastal',
    all: 'All year',
    warm: 'Warm weather',
    cold: 'Cold weather',
    neutral: 'Neutral',
    earth: 'Earth tones',
    rich: 'Rich tones',
  },
  pt: {
    tailored: 'Alfaiataria',
    smart_casual: 'Smart casual',
    heritage: 'Heritage',
    coastal: 'Costeiro',
    all: 'Todo o ano',
    warm: 'Tempo quente',
    cold: 'Tempo frio',
    neutral: 'Neutros',
    earth: 'Tons de terra',
    rich: 'Tons intensos',
  },
};

function storedLang() {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

/** A stored choice wins; otherwise Portuguese browsers get Portuguese. */
function initialLang() {
  const stored = storedLang();
  if (LANGS.includes(stored)) return stored;
  return navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

let lang = initialLang();

export const getLang = () => lang;

export function setLang(next) {
  lang = next;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // The choice then lasts for this page only.
  }
}

export function t(key, vars = {}) {
  const template = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}

export const attributeValue = (value) => ATTRIBUTE_VALUES[lang][value] ?? value;

export const localized = (field) => field[lang] ?? field.en;

export const formatPrice = (value) =>
  new Intl.NumberFormat(LOCALES[lang], {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);

export const formatNumber = (value) => new Intl.NumberFormat(LOCALES[lang]).format(value);

export const formatDecimal = (value, digits = 3) =>
  new Intl.NumberFormat(LOCALES[lang], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

export const formatPercent = (value, digits = 0) =>
  new Intl.NumberFormat(LOCALES[lang], {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

/** "a", "a and b", "a, b and c" */
export function joinList(items) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${t('list.and')} ${items[items.length - 1]}`;
}

export function applyTranslations(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
}
