import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

// Manrope, not Inter — Inter-everywhere is itself a named AI-generation
// tell in the design checklist this app has been redesigned against. Only
// covers Latin glyphs; CJK text falls through to the system font stack in
// globals.css's --font-sans, which is the normal/expected way to pair a
// distinctive Latin display font with Chinese content.
const manrope = Manrope({ subsets: ["latin"], variable: "--font-latin", display: "swap" });

export const metadata: Metadata = {
  title: "OpenMontage Studio",
  description: "Content brainstorm and script generation for OpenMontage creators.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${manrope.variable}`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
