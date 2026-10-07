import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSiteUrl } from "@/config/site";
import "../globals.css";

export const metadata: Metadata = { metadataBase: getSiteUrl() };

export default function RedirectLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}