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
    'footer.privacy': 'Your browsing stays in this tab. The server stores nothing about you.',
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
    'home.count': '{count} products',

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

    'reason.collaborative': 'Visitors interested in {product} also looked at this',
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
      'Move the weights or start from a sample visitor. The list updates straight away, using the same model as the store.',
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
    'lab.popularity': 'Popularity',
    'lab.popularityHint': 'What sells most overall',
    'lab.diversity': 'Diversity',
    'lab.diversityHint': 'Trades relevance for more varied suggestions',
    'lab.reset': 'Reset to tuned values',
    'lab.tuned': 'Tuned values: {collaborative} behaviour, {content} similarity, {popularity} popularity.',
    'lab.results': 'Suggestions',
    'lab.zero': 'At least one weight must be above 0.',
    'lab.score': 'Score {score}',

    'eval.eyebrow': 'Evaluation',
    'eval.title': 'Does it work, and how do we know?',
    'eval.text':
      'The task: a visitor opens a product. Predict the other products they look at in that session, from what they did before.',
    'eval.fact.lists': 'test lists',
    'eval.fact.visitors': 'visitors',
    'eval.fact.events': 'training events',
    'eval.headline':
      'The hybrid finds {ratio}× more of what visitors view next than the rule used in the Visitor Journey store.',
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
    'eval.ranker.content': 'Similarity only',
    'eval.ranker.collaborative': 'Behaviour only',
    'eval.ranker.hybrid': 'Hybrid',
    'eval.lift': 'Is the difference real?',
    'eval.liftText': 'NDCG@10 gain of the hybrid on the same lists, with a 95% confidence interval.',
    'eval.liftInterval': '{low} to {high}',
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
      'Weights were tuned on one dataset. These results come from a second dataset, with a different seed, evaluated once after tuning ended.',
    'eval.method.2':
      'The model trains only on events before a single cutoff, so it never sees anyone’s future.',
    'eval.method.3': 'Intervals come from a bootstrap that resamples whole visitors.',
    'eval.limits': 'What these numbers do not show',
    'eval.limit.1':
      'The data is synthetic. The generator contains the tastes and outfit pairs these models recover, so the results show the system and the comparison work. They do not predict sales in a real store.',
    'eval.limit.2':
      'New products remain a trade-off: recall@10 of {hybrid}, against {content} for similarity only. Giving them more weight lowered overall quality.',
    'eval.limit.3': 'The measure is the next view, not purchases or revenue.',

    'error.load': 'Could not load this. Please try again in a moment.',
    'error.retry': 'Try again',
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
    'footer.privacy': 'A tua navegação fica neste separador. O servidor não guarda nada sobre ti.',
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
    'home.count': '{count} produtos',

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

    'reason.collaborative': 'Quem se interessou por {product} também viu isto',
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
      'Ajusta os pesos ou começa por um visitante de exemplo. A lista atualiza logo, com o mesmo modelo da loja.',
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
    'lab.popularity': 'Popularidade',
    'lab.popularityHint': 'O que mais se vende no geral',
    'lab.diversity': 'Diversidade',
    'lab.diversityHint': 'Troca relevância por sugestões mais variadas',
    'lab.reset': 'Repor valores afinados',
    'lab.tuned':
      'Valores afinados: {collaborative} comportamento, {content} semelhança, {popularity} popularidade.',
    'lab.results': 'Sugestões',
    'lab.zero': 'Pelo menos um peso tem de ser superior a 0.',
    'lab.score': 'Pontuação {score}',

    'eval.eyebrow': 'Avaliação',
    'eval.title': 'Funciona? E como sabemos?',
    'eval.text':
      'A tarefa: um visitante abre um produto. Prever que outros produtos vê nessa sessão, a partir do que fez antes.',
    'eval.fact.lists': 'listas de teste',
    'eval.fact.visitors': 'visitantes',
    'eval.fact.events': 'eventos de treino',
    'eval.headline':
      'O híbrido encontra {ratio}× mais do que os visitantes veem a seguir do que a regra usada na loja do Visitor Journey.',
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
    'eval.ranker.content': 'Só semelhança',
    'eval.ranker.collaborative': 'Só comportamento',
    'eval.ranker.hybrid': 'Híbrido',
    'eval.lift': 'A diferença é real?',
    'eval.liftText': 'Ganho de NDCG@10 do híbrido nas mesmas listas, com intervalo de confiança de 95%.',
    'eval.liftInterval': '{low} a {high}',
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
      'Os pesos foram afinados num conjunto de dados. Estes resultados vêm de um segundo conjunto, com outra seed, avaliado uma vez depois de terminada a afinação.',
    'eval.method.2':
      'O modelo treina só com eventos anteriores a um único corte, por isso nunca vê o futuro de ninguém.',
    'eval.method.3': 'Os intervalos vêm de um bootstrap que reamostra visitantes inteiros.',
    'eval.limits': 'O que estes números não mostram',
    'eval.limit.1':
      'Os dados são sintéticos. O gerador contém os gostos e as combinações que estes modelos recuperam, por isso os resultados mostram que o sistema e a comparação funcionam, mas não preveem vendas numa loja real.',
    'eval.limit.2':
      'Os produtos novos continuam a ser um compromisso: recall@10 de {hybrid}, contra {content} só com semelhança. Dar-lhes mais peso baixou a qualidade geral.',
    'eval.limit.3': 'A medida é a visualização seguinte, não compras nem receita.',

    'error.load': 'Não foi possível carregar. Tenta novamente daqui a pouco.',
    'error.retry': 'Tentar novamente',
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
    earth: 'Tons terra',
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

let lang = LANGS.includes(storedLang()) ? storedLang() : 'en';

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
