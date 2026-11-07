async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

let catalogue;

/** The catalogue, loaded once per page. */
export function getProducts() {
  catalogue ??= request('/api/products').catch((error) => {
    catalogue = undefined;
    throw error;
  });
  return catalogue;
}

export const getProduct = (slug) => request(`/api/products/${encodeURIComponent(slug)}`);
export const getSettings = () => request('/api/settings');
export const getEvaluation = () => request('/api/evaluation');
export const getLook = (productId) => request(`/api/look/${encodeURIComponent(productId)}`);

export const getRecommendations = (body) =>
  request('/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
