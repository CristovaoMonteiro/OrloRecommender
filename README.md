# Orlo Recommender

An explainable hybrid product recommender for Orlo, a fictional premium menswear store. Companion project to [Visitor Journey Dashboard](https://github.com/CristovaoMonteiro/VisitorJourney).

**Status:** in development. All data is synthetic.

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

### Limits

- **The data is synthetic.** I wrote the generator, including the tastes and outfit pairs these models recover. The results show that the pipeline works and that the comparison is sound. They do not predict sales in a real store.
- **New products remain a trade-off.** Hybrid recall@10 on products with fewer than 30 visitors is 0.28, up from 0.07 without the fallback, but below content only at 0.51. Giving them more weight lowered overall quality on the tuning data.
- **The evaluation measures next views,** not purchases or revenue.
- **Selection is not independent of evaluation design.** The hybrid was changed twice after a first test run exposed flaws, which is why the reported test uses a new dataset.

## Local setup

Requires Node 20.19+.

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000.

## Checks

```bash
npm run lint
npm run format:check
npm test
```

## License

MIT
