import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";

import { createProductSchema } from "./lib/products";

const products = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/products" }),
  schema: ({ image }) => createProductSchema(image()),
});

export const collections = { products };
