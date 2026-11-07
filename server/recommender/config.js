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
  // Pulls item-pair lift towards 1 when a pair was carted together only a few times.
  LIFT_PRIOR: 5,

  // Each older interaction in the history counts this much of the next one.
  RECENCY_DECAY: 0.8,
  DEFAULT_WEIGHTS: { collaborative: 0.6, content: 0.4, popularity: 0 },
  // MMR trade-off: 0 ranks by score alone, 1 by difference from the items already picked.
  DEFAULT_DIVERSITY: 0.4,
  // Whether other colours of a product the visitor already saw are left out.
  EXCLUDE_SEEN_LINES: false,
  // "Complete the look" shows at most this many pieces of one category.
  MAX_LOOK_PER_CATEGORY: 2,
};
