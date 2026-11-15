/** Reduce recorded payloads to the fields the adapters read (keeps fixtures small; values untouched). */
export function trimPayload(url: string, json: unknown): unknown {
  if (url.includes("/products.json") && json && typeof json === "object" && Array.isArray((json as { products?: unknown }).products)) {
    return {
      products: (json as { products: Record<string, unknown>[] }).products.map((p) => ({
        id: p.id,
        title: p.title,
        handle: p.handle,
        product_type: p.product_type,
        tags: p.tags,
        images: Array.isArray(p.images) ? p.images.slice(0, 1).map((i: { src?: string }) => ({ src: i.src })) : [],
        variants: Array.isArray(p.variants)
          ? p.variants.map((v: Record<string, unknown>) => ({
              id: v.id,
              title: v.title,
              price: v.price,
              compare_at_price: v.compare_at_price,
              available: v.available,
              option1: v.option1,
              option2: v.option2,
              option3: v.option3
            }))
          : []
      }))
    };
  }
  if (url.includes("/wc/store/v1/products") && Array.isArray(json)) {
    return (json as Record<string, unknown>[]).map((p) => ({
      id: p.id,
      parent: p.parent,
      name: p.name,
      type: p.type,
      permalink: p.permalink,
      variation: p.variation,
      prices: p.prices,
      is_in_stock: p.is_in_stock,
      images: Array.isArray(p.images) ? p.images.slice(0, 1).map((i: { src?: string; thumbnail?: string }) => ({ src: i.src, thumbnail: i.thumbnail })) : [],
      categories: Array.isArray(p.categories) ? p.categories.map((c: { name?: string }) => ({ name: c.name })) : []
    }));
  }
  return json;
}
