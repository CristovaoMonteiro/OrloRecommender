# Experiment plan: recommendations on the product page

This is a plan, not a result. The test has not been run, because Orlo is a fictional store with no real visitors. It shows how the recommender would be judged in a real store, and every figure marked as an assumption would have to be replaced with real data first.

## Why a live test is needed

The offline evaluation shows that the system works on simulated visitors. It cannot show that real people prefer these suggestions, or that they add revenue. It also leaves a product question open: hiding other colours lowers the offline score, and only real behaviour can show whether that rule is right.

## Hypothesis

Replacing "same category first" with the hybrid recommender on the product page will increase the share of visitors who add a product to the bag, without lowering revenue per visitor.

## Design

| Item            | Decision                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------ |
| Unit            | Visitor, so that each person sees one experience throughout                                |
| Groups          | 50% current rule, 50% hybrid                                                               |
| Who is included | Visitors who open at least one product page and have given consent                         |
| Change tested   | The product page list only. "Complete the look" stays off in both groups                   |
| Length          | At least two full weeks, to cover weekly patterns, and until the planned sample is reached |

## Metrics

| Type      | Metric                                          | Decision rule                                  |
| --------- | ----------------------------------------------- | ---------------------------------------------- |
| Primary   | Visitors who add to bag / visitors in the group | Must rise significantly                        |
| Guardrail | Revenue per visitor                             | Must not fall by more than 2%                  |
| Guardrail | Average discount per order                      | Must not rise by more than 2 percentage points |
| Guardrail | Return rate                                     | Must not rise by more than 1 percentage point  |
| Guardrail | Product page load time, 95th percentile         | Must not rise by more than 200 ms              |
| Secondary | Clicks on the suggestions                       | Explains the result, does not decide it        |
| Secondary | Share of views going to new products            | Checks the reach seen offline                  |

The 2%, percentage-point and 200 ms limits are assumptions. The business should set them before the test starts.

## Sample size

Two-sided test of two proportions, with 5% significance and 80% power. `scripts/evaluation/sampleSize.js` calculates these values. The 8% add-to-bag rate is an assumption, to be replaced with the store's real rate.

| Smallest lift worth detecting | From, to     | Visitors per group |
| ----------------------------- | ------------ | ------------------ |
| +5%                           | 8.0% to 8.4% | 73,851             |
| +10%                          | 8.0% to 8.8% | 18,869             |
| +20%                          | 8.0% to 9.6% | 4,918              |

With the +10% target, a store with 5,000 eligible visitors a week would need about 8 weeks. A store with 1,000 a week would need about 38 weeks, so it would have to accept a +20% target or skip the test.

## Before reading the results

- **Check the split.** If the groups are not close to 50/50, stop and fix the assignment. The result cannot be trusted.
- **Do not stop early.** The sample size is fixed in advance. Checking daily and stopping at the first significant result inflates false positives.
- **Limit the segments.** New and returning visitors, and mobile and desktop, are the only planned cuts. Anything else is a question for a later test.

## Decision

| Result                              | Action                                       |
| ----------------------------------- | -------------------------------------------- |
| Primary rises and guardrails hold   | Roll out to everyone                         |
| Primary rises and a guardrail fails | Do not roll out. Investigate the cause first |
| No significant change               | Keep the simpler current rule                |
| Primary falls                       | Keep the current rule and review the model   |

If the test is positive, a follow-up test should compare showing and hiding other colours.
