# Orlo Recommender

An explainable hybrid product recommender for Orlo, a fictional premium menswear store. Open a few products and the suggestions adapt. Each one says why it is there and how much each model contributed.

It is the companion to [Visitor Journey Dashboard](https://github.com/CristovaoMonteiro/VisitorJourney): same brand and event format, but a separate app with its own larger catalogue. All data is synthetic.

**Live demo:** [orlo-recommender.onrender.com](https://orlo-recommender.onrender.com) · **Lab:** [`/lab`](https://orlo-recommender.onrender.com/lab) · **Evaluation:** [`/evaluation`](https://orlo-recommender.onrender.com/evaluation)

> Hosted on Render's free tier: after 15 minutes without traffic the service sleeps, so the first request can take up to a minute.

![Product page with explained suggestions](docs/product.png)

## What you can do

- **Store:** browse 120 products in English or Portuguese and watch "Recommended for you" change as you go.
- **Product page:** see "You may also like" and "Complete the look", each with its reason.
- **Lab:** move the model weights and the diversity setting, or start from a sample visitor, and see the list update.
- **Evaluation:** read how the hybrid compares with simpler approaches, where it falls short, and how a live test would judge it.

![Lab with model weights and a live list](docs/lab.png)

## How it works

| Part              | Approach                                                       | Why                                                                                  |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Similarity        | TF-IDF over product attributes and descriptions                | Works for products with no interactions                                              |
| Behaviour         | Item-to-item cosine on implicit feedback, with shrinkage       | Every score traces back to a product the visitor touched, which makes it explainable |
| Hybrid            | 60% behaviour and 40% similarity, tuned on validation data     | Keeps the ranking quality of behaviour alone while reaching more of the catalogue    |
| No history        | Best sellers                                                   | Popularity only serves visitors with nothing else to go on                           |
| Thin data         | Weight moves to similarity, at a discount                      | New products stay reachable without outranking proven ones                           |
| Diversity         | MMR re-ranking, plus one colour per line in a list             | Avoids four near-identical suggestions                                               |
| Other colours     | Hidden once a product was seen, and linked on the product page | The same jacket in brown is not a discovery                                          |
| Complete the look | Basket lift across categories, weighted by content match       | Going with something differs from resembling it                                      |

The data comes from a seeded generator: 4,000 visitors with hidden tastes in style, palette and budget produce about 60,000 views, bag additions and purchases over 90 days. The hidden tastes exist only to generate events, and the models never read them.

## Privacy

There is no database, account, cookie or tracker. Your browsing stays in `sessionStorage`, which is deleted when the tab closes, and you can clear it at any time. It reaches the server only as the body of a recommendation request, which is answered and not stored. The rate limiter holds your IP address in memory for one minute and never writes it to disk or logs. The hosting provider may keep its own access logs.

## Evaluation

`npm run evaluate` reproduces every number below and writes them to [data/evaluation.json](data/evaluation.json).

**Task:** a visitor opens a product. Given that product and their earlier history, predict the other products they look at in the same session.

**Protocol:** settings were tuned on one synthetic dataset. The results below come from ten other datasets, each with its own seed, evaluated once after tuning ended. The model trains only on events before a single cutoff, so it never sees anyone's future. Intervals are 95% bootstrap, resampling whole visitors.

| Ranker                                                 | Recall@4  | NDCG@10   | Coverage@4 |
| ------------------------------------------------------ | --------- | --------- | ---------- |
| Random                                                 | 0.024     | 0.032     | 100%       |
| Popularity                                             | 0.051     | 0.062     | 9.3%       |
| Same category first (the Visitor Journey store's rule) | 0.084     | 0.104     | 58.9%      |
| Same category, best sellers first                      | 0.104     | 0.121     | 56.3%      |
| Content only                                           | 0.181     | 0.194     | 99.3%      |
| Collaborative only                                     | 0.224     | 0.230     | 94.0%      |
| **Hybrid**                                             | **0.225** | **0.231** | **98.4%**  |

Test set: 11,577 lists from 10,101 simulated visitors. Every ranker follows the same rule on other colours.

Hybrid NDCG@10 minus each alternative, on the same lists:

| Compared with                     | Difference | 95% interval    | Datasets ahead |
| --------------------------------- | ---------- | --------------- | -------------- |
| Same category, best sellers first | +0.110     | 0.103 to 0.116  | 10 of 10       |
| Content only                      | +0.037     | 0.033 to 0.042  | 10 of 10       |
| Collaborative only                | +0.001     | -0.001 to 0.003 | 6 of 10        |

**The main finding:** the hybrid finds about 2.2× more of what visitors view next than best sellers from the same category (1.9× to 2.6× across datasets). It does not rank better than collaborative filtering alone, as that difference is within the margin of error. What it adds is reach:

| Measure                     | Collaborative only | Hybrid |
| --------------------------- | ------------------ | ------ |
| Recall@10 on new products   | 0.04               | 0.09   |
| Catalogue coverage          | 94.0%              | 98.4%  |
| Diversity of the four shown | 0.67               | 0.75   |

**Control:** when the training events are shuffled, which keeps popularity but destroys who liked what, the collaborative model falls from 0.230 to 0.058, level with popularity at 0.062. Its score therefore comes from the behavioural signal.

**Complete the look:** at least one of the four suggestions matched the rest of the basket in 60% of 3,440 baskets, against 13% for the most popular products from other categories.

**How this evaluation changed:** the first run exposed two flaws: the collaborative baseline was still falling back on content, and new products were outranking proven ones. A later review found that nearly 40% of the suggestions were other colours of something already seen, and that a single test dataset overstated the headline. After those fixes, settings were retuned on the tuning dataset, and these numbers come from datasets not used before. The earlier claim that the hybrid beat collaborative filtering did not survive this test.

### Limits

- **The data is synthetic.** I wrote the generator, including the tastes and outfit pairs these models recover. The results show that the pipeline works and that the comparison is sound. They do not predict sales in a real store.
- **Hiding other colours lowers the score.** NDCG@10 falls from 0.366 to 0.231, because simulated visitors often view other colours. I kept the rule because the same jacket in another colour is a poor suggestion, and each product page links to its colours instead. This is a product decision that the offline metric cannot settle.
- **New products remain weak.** Hybrid recall@10 on products with fewer than 30 visitors is 0.09, against 0.24 for content only.
- **The evaluation measures next views,** not purchases or revenue.

**Next step:** [docs/experiment-plan.md](docs/experiment-plan.md) sets out how a live A/B test would decide whether this should ship, with metrics, guardrails, sample size and decision rules. It has not been run.

![Evaluation page](docs/evaluation.png)

## API

| Route                                          | Purpose                                  |
| ---------------------------------------------- | ---------------------------------------- |
| `POST /api/recommendations`                    | Ranked, explained products for a history |
| `GET /api/look/:productId`                     | Products that complete the look          |
| `GET /api/products`, `GET /api/products/:slug` | Catalogue                                |
| `GET /api/settings`                            | Tuned weights and diversity              |
| `GET /api/evaluation`                          | Published evaluation results             |
| `GET /api/health`                              | Health check                             |

```bash
curl -X POST http://localhost:3000/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{"history":[{"productId":"p001","type":"view_product"}],"k":4}'
```

`history` holds up to 50 entries, oldest first, with `view_product`, `add_to_cart` or `purchase` as the type. `contextProductId`, `k`, `weights` (`collaborative` and `content`) and `diversity` are optional. Requests are validated, unknown fields are rejected, and recommendation routes allow 120 requests per minute.

## Project structure

```text
data/                 catalogue, published model and evaluation results
docs/                 experiment plan and screenshots
public/               store, lab and evaluation pages
scripts/
  build-catalogue.js  expands 40 garment lines into 120 products
  build-model.js      trains the published model
  evaluate.js         tunes, tests and writes the results
  data/               seeded visitor and event generator
  evaluation/         metrics, test cases and baselines
server/
  recommender/        models, hybrid and settings
  routes/             API
tests/                unit, API and evaluation tests
```

## Local setup

Requires Node 20.19+.

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000.

To rebuild the generated files:

```bash
npm run catalogue
npm run model
npm run evaluate
```

## Checks

```bash
npm run lint
npm run format:check
npm test
```

## Deploy

[render.yaml](render.yaml) describes one free web service in Frankfurt. In Render, choose **New > Blueprint** and select this repository. There are no secrets to set. Free services sleep when idle, so the first visit can take up to a minute.

## License

MIT
