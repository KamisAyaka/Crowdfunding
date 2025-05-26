"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import * as Tabs from "@radix-ui/react-tabs";
import Link from "next/link";
import { formatETH, formatTime } from "@/utils/formatters";

export interface Proposal {
  projectId: number;
  proposalId: number;
  description: string;
  amount: bigint;
  voteDeadline: bigint;
  executed: boolean;
  passed: boolean;
  yesVotesAmount: bigint;
  status: "pending" | "approved" | "rejected"; // 新增状态字段
}

const GRAPHQL_API_URL = process.env.NEXT_PUBLIC_GRAPHQL_API_URL;

const GET_PROPOSALS = `
query GetProposals($address: String!) {
  allProposalCreateds {
    nodes {
      projectId
      proposalId
      description
      amount
      voteDeadline
    }
  }
  allProjectCreateds(filter: {creator: {equalTo: $address}}){
    nodes {
      id
    }
  }
  allDonationMades(filter: {donor: {equalTo: $address}}) {
    nodes {
      id
    }
  }
}
`;
async function fetchProposals(address?: string): Promise<{
  all: Proposal[];
  created: Proposal[];
  participated: Proposal[];
}> {
  if (!GRAPHQL_API_URL) {
    throw new Error("GraphQL API URL 未定义，请检查环境变量配置");
  }
  const result = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", // 新增头
    },
    body: JSON.stringify({
      query: GET_PROPOSALS,
      variables: { address: address?.toLowerCase() || "" }, // 处理空值
    }),
  });

  const data = await result.json();

  // 合并执行状态数据
  const userProjectIds = new Set(
    data.data.allProjectCreateds.nodes.map((n: any) => n.id)
  );

  // 处理提案基础数据
  const allProposals = data.data.allProposalCreateds.nodes.map((n: any) => ({
    projectId: Number(n.projectId),
    proposalId: Number(n.proposalId),
    description: n.description,
    amount: BigInt(n.amount),
    voteDeadline: BigInt(n.voteDeadline),
  }));

  // 获取用户捐赠过的项目ID
  const donatedProjectIds = new Set(
    data.data.allDonationMades.nodes.map((n: any) => n.id)
  );

  return {
    all: allProposals,
    created: allProposals.filter(
      (p: { projectId: { toString: () => unknown } }) =>
        userProjectIds.has(p.projectId.toString())
    ),
    participated: allProposals.filter(
      (p: { projectId: { toString: () => unknown } }) =>
        donatedProjectIds.has(p.projectId.toString())
    ),
  };
}

export default function MyProposalPage() {
  const { address } = useAccount();
  const { data, isLoading, error } = useQuery<{
    all: Proposal[];
    created: Proposal[];
    participated: Proposal[];
  }>({
    queryKey: ["proposals", address],
    queryFn: () => fetchProposals(address),
  });

  const [activeTab, setActiveTab] = useState<
    "created" | "participated" | "all"
  >("created");

  // 分类提案
  const createdProposals = useMemo(() => data?.created || [], [data]);
  const participatedProposals = useMemo(() => data?.participated || [], [data]);
  const allProposals = useMemo(() => data?.all || [], [data]);

  return (
    <div className="container mx-auto px-4 py-8">
      <Tabs.Root
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
      >
        <Tabs.List className="flex gap-4 border-b w-full">
          <Tabs.Trigger
            value="created"
            className={tabStyle(activeTab === "created")}
          >
            我创建的提案 ({createdProposals.length})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="participated"
            className={tabStyle(activeTab === "participated")}
          >
            我参与的提案 ({participatedProposals.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="all" className={tabStyle(activeTab === "all")}>
            全部提案 ({allProposals.length})
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="created" className="mt-4">
          <ProposalList proposals={createdProposals} />
        </Tabs.Content>
        <Tabs.Content value="participated" className="mt-4">
          <ProposalList proposals={participatedProposals} />
        </Tabs.Content>
        <Tabs.Content value="all" className="mt-4">
          <ProposalList proposals={allProposals} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

// 样式辅助函数
const tabStyle = (active: boolean) =>
  `px-4 py-2 flex-1 text-center ${
    active
      ? "border-b-2 border-blue-500 font-medium"
      : "text-gray-500 hover:text-gray-700"
  }`;
const formatAmount = (amount: bigint) => {
  return `${Number(amount / BigInt(1e18))} ETH`;
};

function ProposalList({ proposals }: { proposals: Proposal[] }) {
  // 在 ProposalList 组件内部添加状态映射
  const statusMap = {
    approved: "✅ 已通过",
    rejected: "❌ 已拒绝",
    pending: "⏳ 待处理",
  } as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {proposals.map((proposal) => (
        <div
          key={`${proposal.projectId}-${proposal.proposalId}`}
          className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold mb-2">
            {" "}
            项目ID: {proposal.projectId}
          </h3>
          <h3 className="text-lg font-semibold mb-2">
            {" "}
            提案ID: {proposal.proposalId}
          </h3>
          <p className="text-sm line-clamp-2 mb-2">{proposal.description}</p>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-500">申请金额：</span>
              <span className="font-mono">{formatETH(proposal.amount)}ETH</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">截止时间：</span>
              <span className="text-blue-600">
                {formatTime(Number(proposal.voteDeadline))}
              </span>
            </div>
          </div>

          {/* 状态区块 */}
          <div className="flex justify-between items-center border-t pt-3">
            <div className="flex items-center space-x-2">
              <span
                className={`text-sm ${
                  proposal.status === "approved"
                    ? "text-green-500"
                    : proposal.status === "rejected"
                    ? "text-red-500"
                    : "text-gray-500"
                }`}
              >
                {statusMap[proposal.status]}
              </span>
              {proposal.executed && (
                <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                  🚀 已执行
                </span>
              )}
            </div>
            <Link
              href={`/proposal/${proposal.proposalId}`}
              className="text-blue-500 text-sm hover:underline flex items-center"
            >
              查看详情
              <svg
                className="w-4 h-4 ml-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
