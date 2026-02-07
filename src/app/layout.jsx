import "./globals.css";
import { GeistSans } from 'geist/font/sans';

export const metadata = {
  title: 'Gym Posture Tracker',
  description: 'AI-powered exercise form analysis',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={GeistSans.className || ''}>
        {children}
      </body>
    </html>
  );
}