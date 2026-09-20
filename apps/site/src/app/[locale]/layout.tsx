import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isLocale } from "@/i18n/config";
import "../globals.css";

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}