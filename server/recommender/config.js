/** Tunable settings of the recommender, kept in one place. */
module.exports = {
  // How much each interaction says about interest.
  EVENT_WEIGHTS: { view_product: 1, add_to_cart: 3, purchase: 5 },

  // Attribute tokens repeated this many times, so they outweigh description words.
  ATTRIBUTE_WEIGHTS: {
    style: 4,
    material: 3,
    category: 2,
    shape: 1,
    season: 2,
    palette: 1,
    formality: 2,
    color: 1,
  },

  // Damps item-item similarity computed from few shared visitors.
  COLLABORATIVE_SHRINKAGE: 10,
  // Behavioural signals are fully trusted from this many visitors on, and in proportion below it.
  COLLABORATIVE_CONFIDENCE_VISITORS: 30,
  // Share of the weight moved to content that a product with no behavioural data keeps.
  UNPROVEN_DISCOUNT: 0.4,
  // How many similar products lend their behaviour to a product with little of its own.
  NEIGHBOURS: 5,
  // Final-score adjustments, each 0 when off, kept only as far as they cost under 1% of
  // accuracy on the tuning data.
  PRICE_FIT_WEIGHT: 0.25,
  SEASON_WEIGHT: 1,
  MARGIN_WEIGHT: 0.5,
  // A season's trend counts for at most this factor, up or down, so that a fast change of
  // season cannot bury a visitor's taste.
  SEASON_TREND_LIMIT: 1.5,
  // Days at the end of the data that define the current season.
  RECENT_DAYS: 21,
  // Pulls item-pair lift towards 1 when a pair was carted together only a few times.
  LIFT_PRIOR: 5,

  // Each older interaction in the history counts this much of the next one.
  RECENCY_DECAY: 0.8,
  DEFAULT_WEIGHTS: { collaborative: 0.8, content: 0.2 },
  // MMR trade-off: 0 ranks by score alone, 1 by difference from the items already picked.
  DEFAULT_DIVERSITY: 0.4,
  // Product rule: another colour of something already seen is not a discovery. The product
  // page links to other colours instead. This costs some offline score, on purpose.
  EXCLUDE_SEEN_LINES: true,
  // "Complete the look" shows at most this many pieces of one category.
  MAX_LOOK_PER_CATEGORY: 2,
};
