import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Public, indexable pages only. lastModified is the date these pages were last changed. */
const UPDATED = new Date("2026-11-13");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: UPDATED, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified: UPDATED, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/demo`, lastModified: UPDATED, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/signup`, lastModified: UPDATED, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/login`, lastModified: UPDATED, changeFrequency: "yearly", priority: 0.3 },
  ];
}
