const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://allindiaiiitsportsmeet.iiitdm.ac.in";

const routes = [
  "",
  "/about",
  "/contact",
  "/events",
  "/gallery",
  "/location",
  "/register",
  "/team",
];

export default function sitemap() {
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/events" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}