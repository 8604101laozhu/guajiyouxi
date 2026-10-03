import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "挂机游戏",
  description: "暗黑 2 装备与手游关卡梯度的挂机游戏。走路/攻击/死亡共用 W2，换武器只换 cosmetics 层。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
