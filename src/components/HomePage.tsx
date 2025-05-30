import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import * as Tabs from "@radix-ui/react-tabs";
import Link from "next/link";
import NFTBox from "./NFTBox";

interface ProjectInfo {
  id: number;
  name: string;
  description: string;
  goal: bigint;
  deadline: bigint;
  completed: boolean;
  isSuccessful: boolean;
}

interface NFTData {
  tokenId: string;
  projectId: string;
  rank: number;
  donationAmount: string;
}

const GET_RECENT_Project = `
query GetProjectById {
  allProjectCreateds {
    nodes {
      id
      name
      description
      goal
      deadline
    }
  }
  allProjectCompleteds {
    nodes {
      id
      isSuccessful
    }
  }
  allProjectFaileds { 
    nodes {
      id
    }
  }
}
`;

const GET_MY_NFTS = `
query GetMyNFTs($recipient: String!) {
  allNftMinteds(filter: {recipient: {equalTo: $recipient}}) {
    nodes {
      tokenId
      id
      rank
      donationAmount
    }
  }
}`;
const GRAPHQL_API_URL = process.env.NEXT_PUBLIC_GRAPHQL_API_URL;
async function fetchProjectsFromGraphQL(): Promise<ProjectInfo[]> {
  if (!GRAPHQL_API_URL) {
    throw new Error("GraphQL API URL 未定义，请检查环境变量配置");
  }

  const response = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: GET_RECENT_Project,
    }),
  });

  const result = (await response.json()) as {
    data: {
      allProjectCreateds: {
        nodes: {
          id: string;
          name: string;
          description: string;
          goal: string;
          deadline: string;
          completed: boolean;
          isSuccessful: boolean;
        }[];
      };
      allProjectCompleteds: {
        // 新增该字段类型声明
        nodes: {
          id: string;
          isSuccessful: boolean;
        }[];
      };
      allProjectFaileds: {
        nodes: {
          id: string;
        }[];
      };
    };
  };

  // 创建完成状态的映射表
  const completionMap = new Map<
    string,
    { completed: boolean; isSuccessful: boolean }
  >(
    result.data.allProjectCompleteds.nodes.map((node) => [
      node.id,
      { completed: true, isSuccessful: node.isSuccessful },
    ])
  );
  const failedMap = new Map<string, boolean>(
    result.data.allProjectFaileds.nodes.map((node) => [node.id, true])
  );

  return result.data.allProjectCreateds.nodes.map((node) => {
    const completion = completionMap.get(node.id) || {
      completed: false,
      isSuccessful: false,
    };

    if (failedMap.has(node.id)) {
      completion.isSuccessful = false;
    }

    return {
      id: Number(node.id),
      name: node.name || "未知项目",
      description: node.description || "无描述",
      goal: BigInt(node.goal || "0"),
      deadline: BigInt(node.deadline || "0"),
      ...completion, // 关键修改：注入完成状态
    };
  });
}
async function fetchMyNFTs(recipient: string): Promise<NFTData[]> {
  if (!GRAPHQL_API_URL) {
    throw new Error("GraphQL API URL 未定义，请检查环境变量配置");
  }
  const response = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: GET_MY_NFTS,
      variables: { recipient: recipient.toLowerCase() },
    }),
  });
  const result = await response.json();
  return result.data.allNftMinteds.nodes.map((n: any) => ({
    tokenId: n.tokenId,
    projectId: n.id.toString(),
    rank: Number(n.rank),
    donationAmount: n.donationAmount,
  }));
}
export default function HomePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjectsFromGraphQL,
    refetchOnMount: true,
    staleTime: 5000,
  });

  const { address } = useAccount();
  const { data: nfts } = useQuery({
    queryKey: ["nfts", address],
    queryFn: () => (address ? fetchMyNFTs(address) : []),
    enabled: !!address,
  });

  const [activeTab, setActiveTab] = useState<"live" | "history" | "nfts">(
    "live"
  );

  const liveProjects = useMemo(
    () => (data ?? []).filter((p) => !p.completed),
    [data]
  );

  const historyProjects = useMemo(
    () => (data ?? []).filter((p) => p.completed),
    [data]
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 创建项目按钮 */}
      <div className="mb-8 flex w-full space-x-4">
        <Link
          href="/create-project"
          className="flex-1 rounded-lg bg-blue-500 px-6 py-2 text-center text-white hover:bg-blue-600 transition-colors"
        >
          🚀 创建众筹项目
        </Link>
        <Link
          href="/proposal"
          className="flex-1 rounded-lg bg-blue-500 px-6 py-2 text-center text-white hover:bg-blue-600 transition-colors"
        >
          🚀 查看项目提案
        </Link>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          读取项目失败：{error instanceof Error ? error.message : "未知错误"}
        </div>
      )}

      {/* 加载中提示 */}
      {isLoading && (
        <div className="text-center py-8 text-gray-500">
          ⏳ 正在加载项目数据...
        </div>
      )}

      {/* 标签页导航 */}
      {!isLoading && (
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
              value="history"
              className={`px-4 py-2 flex-1 text-center ${
                activeTab === "history"
                  ? "border-b-2 border-blue-500 font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              📜 历史项目 ({historyProjects.length})
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

          {/* 各个标签页内容 */}
          <Tabs.Content value="live" className="w-full mt-4">
            <ProjectList projects={liveProjects} />
          </Tabs.Content>

          <Tabs.Content value="history" className="w-full mt-4">
            <ProjectList projects={historyProjects} />
          </Tabs.Content>

          <Tabs.Content value="nfts" className="w-full mt-4">
            {nfts?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {nfts.map((nft) => (
                  <NFTBox
                    key={nft.tokenId}
                    tokenId={nft.tokenId}
                    projectId={nft.projectId}
                    rank={nft.rank}
                    donationAmount={nft.donationAmount}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {address ? "暂无NFT数据" : "请先连接钱包查看NFT"}
              </div>
            )}
          </Tabs.Content>
        </Tabs.Root>
      )}
    </div>
  );
}

function ProjectList({ projects }: { projects: ProjectInfo[] }) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        暂无项目数据，快去创建一个吧！
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => {
        return (
          <div
            key={project.id.toString()}
            className="border rounded-lg p-4 bg-white shadow-md hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold mb-2">{project.name}</h3>
            <p className="text-sm line-clamp-2 mb-2">{project.description}</p>
            <div className="space-y-1">
              <p>目标：{Number(project.goal) / 1e18} ETH</p>
              <span
                className={
                  project.completed
                    ? project.isSuccessful
                      ? "text-green-500"
                      : "text-red-500"
                    : "text-blue-500"
                }
              >
                {project.completed
                  ? project.isSuccessful
                    ? "✅ 成功"
                    : "❌ 失败"
                  : "⏳ 进行中"}
              </span>
            </div>
            <Link href={`/project/${project.id}`} className="text-blue-500">
              查看详情 →
            </Link>
          </div>
        );
      })}
    </div>
  );
}
