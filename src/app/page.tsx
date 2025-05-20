"use client";

import { useAccount } from "wagmi";
import HomePage from "@/components/HomePage";

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <main>
      {!isConnected ? (
        <div className="flex items-center justify-center p-4 md:p-6 xl:p-8">
          Please connect your wallet
        </div>
      ) : (
        <div className="flex items-center justify-center p-4 md:p-6 xl:p-8">
          <HomePage />
        </div>
      )}
    </main>
  );
}
