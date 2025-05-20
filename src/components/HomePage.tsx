import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAccount, useReadContract, useChainId } from "wagmi";
import {
  chainsToContracts,
  CrowdfundingAbi,
  CrowdfundingNFTAbi,
} from "@/constants";
// 在顶部导入语句中添加 TabButton
import * as Tabs from "@radix-ui/react-tabs";
import Link from "next/link";
export default function HomePage() {
  // 分类项目
  const [activeTab, setActiveTab] = useState<"live" | "proposals" | "nfts">(
    "live"
  );
  // HomePage.tsx 核心逻辑补充
  const { address } = useAccount();
  const chainId = useChainId();
  const [CrowdfundingAddress, setCrowdfundingAddress] = useState("");
  const currentChainContracts = chainsToContracts[chainId];
  if (!currentChainContracts) {
    throw new Error(`Unsupported chainId: ${chainId}`);
  }
  // 新增类型定义
  type ProjectInfo = {
    id: bigint;
    creator: string;
    targetAmount: bigint;
    raisedAmount: bigint; // 对应合约中的currentAmount字段
    deadline: bigint;
    completed: boolean;
    isSuccessful: boolean;
  };

  // 修改后的useQuery逻辑
  const { data: projects = [] } = useQuery<ProjectInfo[]>({
    queryKey: ["projects", chainId],
    queryFn: async () => {
      // 获取项目总数
      const countResult = useReadContract({
        abi: CrowdfundingAbi,
        address: currentChainContracts.Crowdfunding as `0x${string}`,
        functionName: "getProjectCount",
      });
      const count = Number(countResult.data || 0);

      // 并行获取所有项目详情
      const projectPromises = Array.from({ length: count }, (_, i) =>
        useReadContract({
          abi: CrowdfundingAbi,
          address: currentChainContracts.Crowdfunding as `0x${string}`,
          functionName: "getProjectInfo",
          args: [BigInt(i)],
        })
      );

      // 等待所有请求完成
      const results = await Promise.all(projectPromises);
      return results.map((res) => {
        const data = res.data as [
          bigint,
          string,
          bigint,
          bigint,
          bigint,
          bigint,
          string,
          string,
          string,
          boolean,
          boolean
        ]; // 根据ABI定义元组类型

        return {
          id: data[0],
          creator: data[1],
          targetAmount: data[2],
          raisedAmount: data[4],
          deadline: data[5],
          completed: data[9],
          isSuccessful: data[10],
        } as ProjectInfo;
      });
    },
  });

  // 更新过滤逻辑
  const liveProjects = useMemo(
    () => projects.filter((p) => !p.completed),
    [projects]
  );

  const successfulProjects = useMemo(
    () => projects.filter((p) => p.completed && p.isSuccessful),
    [projects]
  );
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex w-full space-x-4">
        <Link
          href="/create-project"
          className="flex-1 rounded-lg bg-blue-500 px-6 py-2 text-center text-white hover:bg-blue-600 transition-colors"
        >
          🚀 创建众筹项目
        </Link>
        <Link
          href="/propose"
          className="flex-1 rounded-lg bg-green-500 px-6 py-2 text-center text-white hover:bg-green-600 transition-colors"
        >
          📝 发起新提案
        </Link>
      </div>
      <Tabs.Root
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
        className="w-full mb-8"
      >
        <Tabs.List className="flex gap-4 border-b w-full">
          <Tabs.Trigger
            value="live"
            className={`px-4 py-2 flex-1 text-center ${
              activeTab === "live"
                ? "border-b-2 border-blue-500 font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            🚀 进行中项目 ({liveProjects.length})
          </Tabs.Trigger>

          <Tabs.Trigger
            value="proposals"
            className={`px-4 py-2 flex-1 text-center ${
              activeTab === "proposals"
                ? "border-b-2 border-blue-500 font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            ✅ 成功项目提案 ({successfulProjects.length})
          </Tabs.Trigger>

          <Tabs.Trigger
            value="nfts"
            className={`px-4 py-2 flex-1 text-center ${
              activeTab === "nfts"
                ? "border-b-2 border-blue-500 font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            🎨 我收到的NFT
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    </div>
  );
}
