"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { anvil } from "wagmi/chains";

export default getDefaultConfig({
  appName: "Crowdfunding",
  chains: [anvil],
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  ssr: true,
});
