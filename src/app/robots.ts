import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Public pages are open to every crawler (search and AI assistants alike). The signed-in
 * workspace is never indexed — its layout also sends noindex.
 */
const PRIVATE = [
  "/dashboard",
  "/patients",
  "/schedule",
  "/tasks",
  "/referrals",
  "/documents",
  "/messages",
  "/nutrition",
  "/classes",
  "/billing",
  "/team",
  "/settings",
  "/portal",
  "/onboarding",
  "/help",
  "/kit",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
