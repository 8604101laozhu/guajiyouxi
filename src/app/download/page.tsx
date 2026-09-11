export default function DownloadPage() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs tracking-[0.35em] text-[#c7a24a]">GUAJIYOUXI</p>
      <h1 className="text-2xl font-semibold text-[#f0ead8]">下载挂机游戏工程</h1>
      <p className="max-w-md text-sm leading-6 text-[#cfc3a6]">
        点下面按钮会下载一个 zip。解压到 D:\挂机游戏，在文件夹里运行 npm install。
      </p>
      <a
        href="/api/download"
        className="inline-flex h-12 items-center border border-[#c7a24a] bg-[#1a140c] px-6 text-base text-[#c7a24a]"
      >
        下载 guajiyouxi.zip
      </a>
    </main>
  );
}
