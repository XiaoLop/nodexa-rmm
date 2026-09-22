import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductHome } from "@/components/ProductHome";
import { getContactInfo } from "@/config/contact";
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

  return {
    title: { absolute: dictionary.metadata.title },
    description: dictionary.metadata.description,
    alternates: {
      canonical: `/${locale}`,
      languages: {
        "zh-CN": "/zh-CN",
        en: "/en",
      },
    },
  };
}

export default async function LocalePage({ params }: LocalePageProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <ProductHome locale={locale} dictionary={getDictionary(locale)} contact={getContactInfo()} />;
}
