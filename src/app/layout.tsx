import type { Metadata } from "next";
import { Geist_Mono, Noto_Serif_SC } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const serif = Noto_Serif_SC({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "挂机游戏",
  description: "暗黑 2 装备与手游关卡梯度的挂机游戏。立绘和走路帧放在 public/sprites。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`dark ${serif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
