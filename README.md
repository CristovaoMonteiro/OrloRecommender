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
- **Evaluation:** read how the hybrid compares with simpler approaches, and where it falls short.

![Lab with model weights and a live list](docs/lab.png)

## How it works

| Part              | Approach                                                   | Why                                                                                  |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Similarity        | TF-IDF over product attributes and descriptions            | Works for products with no interactions                                              |
| Behaviour         | Item-to-item cosine on implicit feedback, with shrinkage   | Every score traces back to a product the visitor touched, which makes it explainable |
| Hybrid            | 60% behaviour and 40% similarity, tuned on validation data | Beats either model alone                                                             |
| No history        | Best sellers                                               | There is always something sensible to show                                           |
| Thin data         | Weight moves to similarity, at a discount                  | New products stay reachable without outranking proven ones                           |
| Diversity         | MMR re-ranking, plus one colour per line in a list         | Avoids four near-identical suggestions                                               |
| Complete the look | Basket lift across categories, weighted by content match   | Going with something differs from resembling it                                      |

The data comes from a seeded generator: 4,000 visitors with hidden tastes in style, palette and budget produce about 60,000 views, bag additions and purchases over 90 days. The hidden tastes exist only to generate events, and the models never read them.

## Privacy

There is no database, account, cookie or tracker. Your browsing stays in `sessionStorage`, which is deleted when the tab closes, and you can clear it at any time. It reaches the server only as the body of a recommendation request, which is answered and not stored. The rate limiter holds your IP address in memory for one minute and never writes it to disk or logs.

## Evaluation

`npm run evaluate` reproduces every number below and writes them to [data/evaluation.json](data/evaluation.json).

**Task:** a visitor opens a product. Given that product and their earlier history, predict the other products they look at in the same session.

**Protocol:** weights were tuned on one synthetic dataset. The results below come from a second dataset, generated with a different seed and evaluated once after tuning ended. In both, the model trains only on events before a single cutoff, so it never sees anyone's future. Intervals are 95% bootstrap, resampling whole visitors.

| Ranker                                                 | Recall@4  | NDCG@10   | Coverage@4 |
| ------------------------------------------------------ | --------- | --------- | ---------- |
| Random                                                 | 0.038     | 0.049     | 100%       |
| Popularity                                             | 0.050     | 0.070     | 7.5%       |
| Same category first (the Visitor Journey store's rule) | 0.142     | 0.176     | 38.3%      |
| Content only                                           | 0.296     | 0.338     | 100%       |
| Collaborative only                                     | 0.344     | 0.355     | 94.2%      |
| **Hybrid**                                             | **0.369** | **0.382** | **99.2%**  |

Test set: 1,120 lists from 990 visitors.

Hybrid NDCG@10 minus each alternative, on the same lists:

| Compared with       | Difference | 95% interval   |
| ------------------- | ---------- | -------------- |
| Same category first | +0.207     | 0.183 to 0.232 |
| Content only        | +0.045     | 0.027 to 0.062 |
| Collaborative only  | +0.027     | 0.018 to 0.037 |

**Control:** when the training events are shuffled, which keeps popularity but destroys who liked what, the collaborative model falls from 0.355 to 0.067, level with popularity at 0.070. Its score therefore comes from the behavioural signal.

**Complete the look:** at least one of the four suggestions matched the rest of the basket in 61% of 355 baskets, against 11% for the most popular products from other categories.

**What the first run changed:** it exposed two flaws. The collaborative baseline was still falling back on content, and new products were outranking proven ones. After fixing both, I retuned on validation data and reported on the new dataset, so those fixes could not be fitted to the published numbers.

### Limits

- **The data is synthetic.** I wrote the generator, including the tastes and outfit pairs these models recover. The results show that the pipeline works and that the comparison is sound. They do not predict sales in a real store.
- **New products remain a trade-off.** Hybrid recall@10 on products with fewer than 30 visitors is 0.28, up from 0.07 without the fallback, but below content only at 0.51. Giving them more weight lowered overall quality on the tuning data.
- **The evaluation measures next views,** not purchases or revenue.

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

`history` holds up to 50 entries, oldest first, with `view_product`, `add_to_cart` or `purchase` as the type. `contextProductId`, `k`, `weights` and `diversity` are optional. Requests are validated, unknown fields are rejected, and recommendation routes allow 120 requests per minute.

## Project structure

```text
data/                 catalogue, published model and evaluation results
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
