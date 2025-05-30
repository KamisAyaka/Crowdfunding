// app/proposal/[proposalId]/page.tsx
"use client";

import { useParams } from "next/navigation";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { chainsToContracts, ProposalGovernanceAbi } from "@/constants";
import { formatETH, formatTime } from "@/utils/formatters";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const GRAPHQL_API_URL = process.env.NEXT_PUBLIC_GRAPHQL_API_URL;

interface Proposal {
  projectId: number;
  proposalId: number;
  description: string;
  amount: bigint;
  voteDeadline: bigint;
  executed: boolean;
  passed: boolean;
  yesVotesAmount: bigint;
  noVotesAmount: bigint;
}

const GET_PROPOSAL_DETAIL = `
query GetProposalDetail($projectId: String!, $proposalId: String!) {
  allProposalCreateds(condition: { 
    projectId: $projectId, 
    proposalId: $proposalId 
  }) {
    nodes {
      projectId
      proposalId
      description
      amount
      voteDeadline
    }
  }
  allVoteds(condition: { 
    projectId: $projectId, 
    proposalId: $proposalId 
  }) {
    nodes {
      voter
      support
      amount
    }
  }
  allProposalExecuteds(condition: { 
    projectId: $projectId, 
    proposalId: $proposalId 
  }) {
    nodes {
      passed
    }
  }
}
`;

async function fetchProposalDetail(
  projectId: string,
  proposalId: string
): Promise<Proposal> {
  if (!GRAPHQL_API_URL) throw new Error("GraphQL API URL 未定义");

  const response = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: GET_PROPOSAL_DETAIL,
      variables: { projectId, proposalId },
    }),
  });

  const { data } = await response.json();
  const proposal = data?.allProposalCreateds?.nodes?.[0];
  if (!proposal) throw new Error("未找到对应提案");

  // 计算投票金额
  const votes = data?.allVoteds?.nodes || [];
  const yesVotesAmount = votes
    .filter((v: any) => v.support)
    .reduce((acc: bigint, v: any) => acc + BigInt(v.amount), BigInt(0));

  const noVotesAmount = votes
    .filter((v: any) => !v.support)
    .reduce((acc: bigint, v: any) => acc + BigInt(v.amount), BigInt(0));

  const executedProposal = data?.allProposalExecuteds?.nodes?.[0];

  return {
    ...proposal,
    yesVotesAmount,
    noVotesAmount,
    executed: !!executedProposal, // 存在执行记录即为已执行
    passed: executedProposal?.passed ?? false, // 从事件中获取通过状态
  };
}

export default function ProposalDetailPage() {
  const params = useParams() as { id: string; proposalId: string };
  const { id: projectId, proposalId } = params;
  const { address } = useAccount();
  const chainId = useChainId();
  const currentChainContracts = chainsToContracts[chainId];

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 数据获取函数
  const fetchData = useCallback(async () => {
    try {
      if (!address) return;

      setIsLoading(true);
      const data = await fetchProposalDetail(
        projectId.toString(),
        proposalId.toString()
      );
      setProposal(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取提案失败");
    } finally {
      setIsLoading(false);
    }
  }, [address, projectId, proposalId]);

  // 初始化加载和参数变化时刷新
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 投票处理
  const {
    writeContract: voteWrite,
    isPending: isVoting,
    error: voteError,
    data: voteHash,
  } = useWriteContract();
  const { isLoading: isVoteConfirming } = useWaitForTransactionReceipt({
    hash: voteHash,
  });
  const handleVote = (support: boolean) => {
    if (!proposal || !address) return;

    voteWrite({
      address: currentChainContracts.ProposalGovernance as `0x${string}`,
      abi: ProposalGovernanceAbi,
      functionName: "voteOnProposal",
      args: [BigInt(proposal.projectId), BigInt(proposal.proposalId), support],
    });
  };

  // 执行提案处理
  const {
    writeContract: executeWrite,
    isPending: isExecuting,
    error: executeError,
    data: executeHash,
  } = useWriteContract();
  const { isLoading: isExecuteConfirming } = useWaitForTransactionReceipt({
    hash: executeHash,
  });

  const handleExecute = () => {
    if (!proposal) return;

    executeWrite({
      address: currentChainContracts.ProposalGovernance as `0x${string}`,
      abi: ProposalGovernanceAbi,
      functionName: "executeProposal",
      args: [BigInt(proposal.projectId), BigInt(proposal.proposalId)],
    });
  };

  // 投票统计计算
  const totalVotes = useMemo(() => {
    if (!proposal) return 0;
    return Number(proposal.yesVotesAmount + proposal.noVotesAmount);
  }, [proposal]);

  if (isLoading)
    return <div className="container mx-auto px-4 py-8">加载中...</div>;
  if (error)
    return (
      <div className="container mx-auto px-4 py-8 text-red-500">{error}</div>
    );
  if (!proposal)
    return (
      <div className="container mx-auto px-4 py-8 text-red-500">提案不存在</div>
    );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* 返回按钮 */}
        <Link
          href="/proposal"
          className="text-blue-500 hover:underline mb-4 inline-block"
        >
          ← 返回提案列表
        </Link>

        {/* 提案基本信息 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">提案详情</h3>
          <p className="text-gray-600 whitespace-pre-wrap">
            {proposal.description || "暂无详细描述"}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <InfoItem label="项目ID" value={proposal.projectId} />
          <InfoItem label="提案ID" value={proposal.proposalId} />
          <InfoItem
            label="申请金额"
            value={`${formatETH(proposal.amount)} ETH`}
          />
          <InfoItem
            label="投票截止"
            value={formatTime(Number(proposal.voteDeadline))}
          />
        </div>

        {/* 投票状态 */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">投票统计</h3>
            <span
              className={`badge ${
                proposal.executed
                  ? proposal.passed
                    ? "bg-green-100"
                    : "bg-red-100"
                  : Date.now() < Number(proposal.voteDeadline) * 1000
                  ? "bg-yellow-100"
                  : "bg-blue-100"
              }`}
            >
              {proposal.executed
                ? proposal.passed
                  ? "已通过"
                  : "未通过"
                : Date.now() < Number(proposal.voteDeadline) * 1000
                ? "投票中"
                : "等待执行"}
            </span>
          </div>
          <div className="space-y-2">
            <ProgressBar
              label="支持率"
              value={(Number(proposal.yesVotesAmount) / 1e18).toFixed(2)}
              percentage={
                totalVotes > 0
                  ? (Number(proposal.yesVotesAmount) / totalVotes) * 100
                  : 0
              }
            />
            <ProgressBar
              label="反对率"
              value={(Number(proposal.noVotesAmount) / 1e18).toFixed(2)}
              percentage={
                totalVotes > 0
                  ? (Number(proposal.noVotesAmount) / totalVotes) * 100
                  : 0
              }
            />
            <InfoItem
              label="总投票额"
              value={`${formatETH(totalVotes.toString())} ETH`}
            />
          </div>
        </div>

        {/* 操作按钮区 */}
        <div className="border-t pt-4">
          {!proposal.executed && (
            <div className="flex flex-col md:flex-row gap-4">
              {/* 修改提案结束的判断时间用于测试 */}
              {Date.now() + 86400 * 2000 <
              Number(proposal.voteDeadline) * 1000 ? (
                <>
                  <button
                    onClick={() => handleVote(true)}
                    disabled={isVoting || isVoteConfirming}
                    className="bg-green-500 text-white px-6 py-2 rounded-lg flex-1 disabled:opacity-50"
                  >
                    {isVoting
                      ? "签名中..."
                      : isVoteConfirming
                      ? "确认中..."
                      : "👍 支持提案"}
                  </button>
                  <button
                    onClick={() => handleVote(false)}
                    disabled={isVoting || isVoteConfirming}
                    className="bg-red-500 text-white px-6 py-2 rounded-lg flex-1 disabled:opacity-50"
                  >
                    {isVoting
                      ? "签名中..."
                      : isVoteConfirming
                      ? "确认中..."
                      : "👎 反对提案"}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleExecute}
                  disabled={isExecuting || isExecuteConfirming}
                  className="bg-blue-500 text-white px-6 py-2 rounded-lg w-full disabled:opacity-50"
                >
                  {isExecuting
                    ? "提交中..."
                    : isExecuteConfirming
                    ? "确认中..."
                    : "执行提案"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* 交易状态反馈 */}
        {voteError && (
          <div className="mt-4 text-red-500">投票失败: {voteError.message}</div>
        )}
        {executeError && (
          <div className="mt-4 text-red-500">
            执行失败: {executeError.message}
          </div>
        )}
      </div>
    </div>
  );
}

// 辅助组件
const InfoItem = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
    <span className="text-gray-600">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

const ProgressBar = ({
  label,
  value,
  percentage,
}: {
  label: string;
  value: string;
  percentage: number;
}) => (
  <div>
    <div className="flex justify-between mb-1">
      <span className="text-sm">{label}</span>
      <span className="text-sm">
        {value} ETH ({percentage.toFixed(1)}%)
      </span>
    </div>
    <div className="h-2 bg-gray-200 rounded-full">
      <div
        className="h-2 bg-blue-500 rounded-full transition-all"
        style={{ width: `${percentage}%` }}
      />
    </div>
  </div>
);
