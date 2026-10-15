import { tr } from "./i18n/translate";

export function browserAddress(value: string): string {
  const input = value.trim();
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      /\s/.test(input)
    )
      throw new Error("Invalid address");
    return url.href;
  } catch {
    throw new Error(tr("tools.enterWebsiteAddress"));
  }
}

export function browserSite(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "") || tr("app.titleBrowser");
  } catch {
    return tr("app.titleBrowser");
  }
}
