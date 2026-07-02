import type { Metadata } from "next";
import { AppFrame } from "../components/app-frame";
import { getCurrentSession } from "../lib/server-session";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioPath SARS-CoV-2 Genomic Intelligence Platform",
  description: "Upload FASTA files and analyze SARS-CoV-2 mutations against NC_045512.2"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getCurrentSession();

  return (
    <html lang="en">
      <body>
        <AppFrame userName={session.userName} username={session.username}>
          {children}
        </AppFrame>
      </body>
    </html>
  );
}
