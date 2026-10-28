import "./globals.css";
import AppProviders from "@/components/AppProviders";
import Navbar from "@/components/Navbar";
import { headers } from "next/headers";

export const metadata = {
  title: {
    default: "Movie Verse — find your next film",
    template: "%s — Movie Verse",
  },
  description:
    "Discover popular movies, explore by genre, and keep a personal list of films to watch.",
  applicationName: "Movie Verse",
};

export default async function RootLayout({ children }) {
  await headers();

  return (
    <html lang="en">
      <body>
        <AppProviders>
          <div className="app-shell">
            <Navbar />
            <main className="main-content">{children}</main>
            <footer className="site-footer">
              <span>Movie Verse</span>
              <span>Discover stories worth returning to.</span>
            </footer>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
