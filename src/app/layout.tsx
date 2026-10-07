import type { Metadata } from "next";
import localFont from "next/font/local";
import { MockApiProvider } from "@/components/providers/mock-api-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { MotionProvider } from "@/components/providers/motion-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

// Fonts are self-hosted from npm packages, so builds never depend on Google's servers.
// (next/font requires literal paths, so they are written out in full.)
const display = localFont({
  src: "../../node_modules/@fontsource-variable/lora/files/lora-latin-wght-normal.woff2",
  variable: "--font-display-face",
  weight: "400 700",
  display: "swap",
});

const sans = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-sans-face",
  weight: "100 900",
  display: "swap",
});

const mono = localFont({
  src: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-mono-face",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "RetailHub", template: "%s · RetailHub" },
  description: "Stock, sales and store oversight in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", display.variable, sans.variable, mono.variable)}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <MotionProvider>
            <MockApiProvider>
              <QueryProvider>
                <TooltipProvider>{children}</TooltipProvider>
              </QueryProvider>
            </MockApiProvider>
            <Toaster />
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
