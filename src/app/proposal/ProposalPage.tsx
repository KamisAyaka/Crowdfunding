import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import * as Tabs from "@radix-ui/react-tabs";
import Link from "next/link";

interface Proposal {
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
    body: JSON.stringify({
      query: GET_PROPOSALS,
      variables: { address: address?.toLowerCase() },
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
    data.data.allDonationMades.nodes.map((n: any) => n.projectId)
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
            我创建的 ({createdProposals.length})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="participated"
            className={tabStyle(activeTab === "participated")}
          >
            我参与的 ({participatedProposals.length})
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

function ProposalList({ proposals }: { proposals: Proposal[] }) {
  if (proposals.length === 0) {
    return <div className="text-center py-8 text-gray-500">暂无提案</div>;
  }

  // 定义带类型注解的状态映射
  const statusMap: Record<Proposal["status"], string> = {
    pending: "⏳ 审核中",
    approved: "✅ 已通过",
    rejected: "❌ 已拒绝",
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {proposals.map((proposal) => (
        <div
          key={proposal.proposalId}
          className="border rounded-lg p-4 bg-white shadow-sm"
        >
          <h3 className="font-semibold mb-2">{proposal.description}</h3>{" "}
          {/* 使用 description */}
          <div className="flex justify-between items-center">
            <span
              className={`text-sm ${
                proposal.status === "approved"
                  ? "text-green-500"
                  : proposal.status === "rejected"
                  ? "text-red-500"
                  : "text-gray-500"
              }`}
            >
              {statusMap[proposal.status]} {/* 类型安全访问 */}
            </span>
            <Link
              href={`/proposal/${proposal.proposalId}`} // 使用 proposalId
              className="text-blue-500 text-sm hover:underline"
            >
              查看详情
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
