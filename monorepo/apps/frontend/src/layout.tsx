import React from 'react';
// import { Helmet } from 'react-helmet';
import "./globals.css";

// RootLayout Component
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Helmet to manage metadata like title and description */}
      {/* <Helmet>
        <html lang="en" />
        <title>Chat LangChain</title>
        <meta name="description" content="Chatbot for LangChain" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </Helmet> */}

      {/* The main layout for the app */}
      <div
        className="flex flex-col h-full md:p-8"
        style={{ background: "rgb(38, 38, 41)" }}
      >
        {children}
      </div>
    </>
  );
}
