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
import { useQuery } from "@tanstack/react-query";
import { Proposal } from "../page"; // 复用提案类型定义
import { formatETH, formatTime } from "@/utils/formatters";
import Link from "next/link";

export default function ProposalDetailPage() {
  const { proposalId } = useParams();
  const { address } = useAccount();
  const chainId = useChainId();
  const currentChainContracts = chainsToContracts[chainId];

  // 获取提案详情
  const { data: proposal, isLoading } = useQuery<Proposal>({
    queryKey: ["proposal", proposalId],
    queryFn: async () => {
      const response = await fetch("/api/proposals/" + proposalId);
      if (!response.ok) throw new Error("提案加载失败");
      return response.json();
    },
  });

  // 投票交易处理
  const {
    writeContract: voteWrite,
    isPending: isVoting,
    error: voteError,
  } = useWriteContract();
  const { isLoading: isVoteConfirming } = useWaitForTransactionReceipt({
    hash: voteHash,
  });

  // 执行提案交易处理
  const {
    writeContract: executeWrite,
    isPending: isExecuting,
    error: executeError,
  } = useWriteContract();
  const { isLoading: isExecuteConfirming } = useWaitForTransactionReceipt({
    hash: executeHash,
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

  const handleExecute = () => {
    if (!proposal) return;

    executeWrite({
      address: currentChainContracts.ProposalGovernance as `0x${string}`,
      abi: ProposalGovernanceAbi,
      functionName: "executeProposal",
      args: [BigInt(proposal.projectId), BigInt(proposal.proposalId)],
    });
  };

  if (isLoading)
    return <div className="container mx-auto px-4 py-8">加载中...</div>;
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
        <h1 className="text-2xl font-bold mb-4">{proposal.description}</h1>
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
                proposal.status === "approved"
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {proposal.status === "approved"
                ? "已通过"
                : proposal.passed
                ? "等待执行"
                : "未通过"}
            </span>
          </div>
          <div className="space-y-2">
            <ProgressBar
              label="支持率"
              value={(Number(proposal.yesVotesAmount) / 1e18).toFixed(2)}
              percentage={
                (Number(proposal.yesVotesAmount) /
                  Number(proposal.totalVotes)) *
                100
              }
            />
          </div>
        </div>

        {/* 操作按钮区 */}
        <div className="border-t pt-4">
          {!proposal.executed && (
            <div className="flex flex-col md:flex-row gap-4">
              {new Date() < proposal.voteDeadline * 1000 ? (
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
                address?.toLowerCase() === proposal.creator.toLowerCase() && (
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
                )
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
