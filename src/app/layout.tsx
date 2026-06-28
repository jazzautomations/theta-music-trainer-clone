export const metadata = {
  title: "Theta Music Trainer — Clone",
  description: "Clone do Theta Music Trainer — 113 jogos de ear training e teoria musical",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
