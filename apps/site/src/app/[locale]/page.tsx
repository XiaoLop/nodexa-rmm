import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductHome } from "@/components/ProductHome";
import { getContactInfo } from "@/config/contact";
import { getConsoleUrl, getSiteUrl } from "@/config/site";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type LocalePageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const dictionary = getDictionary(locale);
  const siteUrl = getSiteUrl();
  const pageUrl = new URL(`/${locale}`, siteUrl);

  return {
    metadataBase: siteUrl,
    title: { absolute: dictionary.metadata.title },
    description: dictionary.metadata.description,
    alternates: {
      canonical: pageUrl,
      languages: {
        "zh-CN": new URL("/zh-CN", siteUrl),
        en: new URL("/en", siteUrl),
        "x-default": new URL("/zh-CN", siteUrl),
      },
    },
    openGraph: {
      type: "website",
      locale: locale === "zh-CN" ? "zh_CN" : "en_US",
      alternateLocale: locale === "zh-CN" ? ["en_US"] : ["zh_CN"],
      url: pageUrl,
      siteName: "Nodexa RMM",
      title: dictionary.metadata.title,
      description: dictionary.metadata.description,
    },
    twitter: { card: "summary_large_image", title: dictionary.metadata.title, description: dictionary.metadata.description },
    robots: { index: true, follow: true },
  };
}

export default async function LocalePage({ params }: LocalePageProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = getDictionary(locale);
  const siteUrl = getSiteUrl();
  const consoleUrl = getConsoleUrl();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Nodexa RMM",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: new URL(`/${locale}`, siteUrl).toString(),
    description: dictionary.metadata.description,
    inLanguage: locale,
    image: new URL(`/${locale}/opengraph-image`, siteUrl).toString(),
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <ProductHome locale={locale} dictionary={dictionary} contact={getContactInfo()} consoleUrl={consoleUrl?.toString()} />
  </>;
}
