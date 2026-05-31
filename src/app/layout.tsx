import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'まどマギ情報まとめ',
  description: '魔法少女まどか☆マギカの公式・一番くじ情報を一か所にまとめたサイト',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
