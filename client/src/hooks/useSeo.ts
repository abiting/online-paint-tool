import { useEffect } from "react";

type SeoConfig = {
  title: string;
  description: string;
  lang: "zh-Hant" | "en";
  canonical: string;
};

function upsertMeta(selector: string, attribute: "name" | "property", value: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, selector.match(/="([^"]+)"/)?.[1] ?? "");
    document.head.appendChild(element);
  }
  element.setAttribute("content", value);
}

export function useSeo({ title, description, lang, canonical }: SeoConfig) {
  useEffect(() => {
    document.title = title;
    document.documentElement.lang = lang;

    upsertMeta('meta[name="description"]', "name", description);
    upsertMeta('meta[property="og:title"]', "property", title);
    upsertMeta('meta[property="og:description"]', "property", description);
    upsertMeta('meta[name="twitter:title"]', "name", title);
    upsertMeta('meta[name="twitter:description"]', "name", description);

    let canonicalElement = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalElement) {
      canonicalElement = document.createElement("link");
      canonicalElement.rel = "canonical";
      document.head.appendChild(canonicalElement);
    }
    canonicalElement.href = canonical;
  }, [canonical, description, lang, title]);
}
