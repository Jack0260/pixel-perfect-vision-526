export const pageMeta = (title: string, description: string) => ({
  meta: [
    { title: `${title} — SOVEREIGN` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — SOVEREIGN` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ],
});

export const pct = (v: number, d = 1) => `${v.toFixed(d)}%`;
export const usd = (v: number) => `$${v.toFixed(2)}`;
export const kg = (g: number) => `${(g / 1000).toFixed(2)} kg`;
