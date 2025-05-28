"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { chainsToContracts, CrowdfundingAbi } from "@/constants";
import { parseEther } from "viem";
import toast from "react-hot-toast";
import Link from "next/link";
import { formatETH } from "@/utils/formatters";

export interface ProjectInfo {
  id: number;
  creator: string;
  name: string;
  description: string;
  goal: bigint;
  deadline: number;
  txHash?: string;
  currentAmount: bigint;
  totalAmount: bigint;
  allowance: bigint;
  completed: boolean;
  isSuccessful: boolean;
  totalWithdrawn: bigint;
}

const GRAPHQL_API_URL = process.env.NEXT_PUBLIC_GRAPHQL_API_URL;

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { address } = useAccount();
  const chainId = useChainId();
  const currentChainContracts = chainsToContracts[chainId];

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 捐赠相关状态
  const [donations, setDonations] = useState<
    Array<{
      donor: string;
      txHash: string;
      amount: string;
    }>
  >([]);
  const [donationAmount, setDonationAmount] = useState("");
  const [showDonations, setShowDonations] = useState(false);
  const [expandedDonations, setExpandedDonations] = useState<Set<number>>(
    new Set()
  );
  const toggleDonation = (index: number) => {
    const newSet = new Set(expandedDonations);
    newSet.has(index) ? newSet.delete(index) : newSet.add(index);
    setExpandedDonations(newSet);
  };
  const {
    data: hash,
    writeContract,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  // 获取项目完成状态
  const {
    data: completeHash,
    writeContract: writeCompleteContract,
    isPending: isCompleting,
    error: completeError,
  } = useWriteContract();

  const { isLoading: isCompletingConfirming, isSuccess: isCompleted } =
    useWaitForTransactionReceipt({
      hash: completeHash, // 需要从 writeCompleteContract 获取 hash
    });

  // 取款状态
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawLoading, setIsWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [operationHash, setOperationHash] = useState<`0x${string}`>();

  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawConfirmed } =
    useWaitForTransactionReceipt({
      hash: operationHash, // 来自提款操作的哈希
    });
  // 提案状态
  const [proposals, setProposals] = useState<
    Array<{
      id: string;
      deadline: number;
      executed: boolean;
      passed: boolean;
    }>
  >([]);
  const [showProposals, setShowProposals] = useState(false);

  const { writeContractAsync } = useWriteContract();
  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    if (!donationAmount || Number(donationAmount) <= 0) {
      toast.error("请输入有效捐赠金额");
      return;
    }

    try {
      writeContract({
        address: currentChainContracts.Crowdfunding as `0x${string}`,
        abi: CrowdfundingAbi,
        functionName: "donate",
        args: [BigInt(projectId)],
        value: parseEther(donationAmount),
      });
    } catch (err) {
      toast.error(
        `捐赠失败: ${err instanceof Error ? err.message : "未知错误"}`
      );
    }
  };

  const handleCompleteProject = async () => {
    if (!address || !project) {
      toast.error("请先连接钱包");
      return;
    }
    // 添加截止时间校验（检测的是现实的时间，因为是模拟区块链的时间，所以不执行截止时间校验）
    // if (Date.now() < Number(project.deadline) * 1000) {
    //   toast.error("项目截止时间未到");
    //   return;
    // }

    try {
      // 直接对捐赠记录排序（按单笔金额降序）
      const sortedDonations = [...donations]
        .sort((a, b) => Number(BigInt(b.amount) - BigInt(a.amount)))
        .slice(0, 5);

      // 提取前五名地址和对应金额
      const topDonors = sortedDonations.map((d) => d.donor);
      const topAmounts = sortedDonations.map((d) => BigInt(d.amount));

      writeCompleteContract({
        address: currentChainContracts.Crowdfunding as `0x${string}`,
        abi: CrowdfundingAbi,
        functionName: "completeProject",
        args: [BigInt(project.id), topDonors, topAmounts],
      });
      toast.success("项目结束请求已提交");
    } catch (err) {
      toast.error(
        `操作失败: ${err instanceof Error ? err.message : "未知错误"}`
      );
    }
  };
  const handleFundsOperation = async (
    operationType: "withdraw" | "refund",
    amount?: string
  ) => {
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    try {
      setIsWithdrawLoading(true);

      const config = {
        address: currentChainContracts.Crowdfunding as `0x${string}`,
        abi: CrowdfundingAbi,
        functionName: operationType === "withdraw" ? "withdrawFunds" : "refund",
        args:
          operationType === "withdraw"
            ? [BigInt(projectId), parseEther(amount || "0")]
            : [BigInt(projectId)],
      };

      const txHash = await writeContractAsync(config);
      toast.success(
        `${operationType === "withdraw" ? "提取" : "退款"}请求已提交`
      );
      setOperationHash(txHash);
    } catch (err) {
      setWithdrawError(
        `${operationType === "withdraw" ? "提取" : "退款"}失败: ${
          err instanceof Error ? err.message : "未知错误"
        }`
      );
    } finally {
      setIsWithdrawLoading(false);
    }
  };

  const fetchProject = useCallback(async () => {
    // 检查 GRAPHQL_API_URL 是否存在
    if (!GRAPHQL_API_URL) {
      setError("GraphQL API 地址未配置");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(GRAPHQL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
              query GetProjectById($id: String!) {
                allProjectCreateds(filter: { id: { equalTo: $id } }) {
                  nodes {
                    id
                    creator
                    name
                    description
                    goal
                    deadline
                    txHash
                  }
                }
                allDonationMades(filter: { id: { equalTo: $id } }) {
                  nodes {
                    amount
                    currentAmount
                    donor
                    txHash
                  }
                }
                allProjectCompleteds(filter:{ id: { equalTo: $id } }) {
                  nodes {
                    isSuccessful
                  }
                }
                allAllowenceIncreaseds(filter: { id: { equalTo: $id } }) {
                  nodes {
                    allowence
                  }
                }
                allProjectFaileds(filter: { id: { equalTo: $id } }) {
                  nodes {
                    id
                  }
                }
                allFundsWithdrawns(filter: { id: { equalTo: $id } }) {
                  nodes {
                    amount
                  }
                }
              }
          `,
          variables: {
            id: projectId,
          },
        }),
      });

      const result = await response.json();
      if (result.data?.allProjectCreateds?.nodes?.length > 0) {
        const node = result.data.allProjectCreateds.nodes[0];
        const donations = result.data.allDonationMades?.nodes || [];
        const uniqueDonations = donations.reduce((acc: any, donation: any) => {
          acc[donation.donor] = donation; // 相同地址会覆盖为最新记录
          return acc;
        }, {});
        setDonations(Object.values(uniqueDonations));
        // 获取最新的currentAmount（取最后一个捐赠记录的currentAmount）
        const latestDonation = donations[donations.length - 1];
        const currentAmount = latestDonation
          ? BigInt(latestDonation.currentAmount)
          : BigInt(0);

        const completedData = result.data.allProjectCompleteds?.nodes[0];
        const isSuccessful = completedData?.isSuccessful || false;

        // 处理allowence更新（取最新值）
        const allowanceEvents =
          result.data?.allAllowenceIncreaseds?.nodes || [];
        var allowance = BigInt(0);
        if (isSuccessful) {
          // 初始额度为总金额的25%
          allowance = (currentAmount * BigInt(25)) / BigInt(100);

          // 如果有额度增加事件，使用最新值覆盖初始额度
          if (allowanceEvents.length > 0) {
            allowance = BigInt(
              allowanceEvents[allowanceEvents.length - 1].allowence
            );
          }
        }
        // 处理项目失败状态（直接覆盖isSuccessful）
        const hasFailed = result.data?.allProjectFaileds?.nodes?.length > 0;

        // 新增提款数据计算
        const withdrawals = result.data?.allFundsWithdrawns?.nodes || [];
        const totalWithdrawn = withdrawals.reduce(
          (acc: bigint, w: any) => acc + BigInt(w.amount),
          BigInt(0)
        );

        setProject({
          id: node.id,
          creator: node.creator.toLowerCase(),
          name: node.name,
          description: node.description || "暂无描述",
          goal: node.goal,
          deadline: node.deadline,
          txHash: node.txHash,
          currentAmount: currentAmount - totalWithdrawn,
          totalAmount: currentAmount,
          allowance: allowance,
          completed: completedData !== undefined,
          isSuccessful: hasFailed ? false : isSuccessful,
          totalWithdrawn: totalWithdrawn,
        });
      } else {
        setError("找不到该项目");
      }

      setLoading(false);
    } catch (err) {
      setError("无法加载项目详情");
      setLoading(false);
    }
  }, [projectId]);

  const fetchProposal = useCallback(async () => {
    if (!GRAPHQL_API_URL) {
      setError("GraphQL API 地址未配置");
      return;
    }

    try {
      const GET_PROPOSALS = `
      query GetProposals($projectId: String!) {
        allProposalCreateds(filter: {projectId: {equalTo: $projectId}}, orderBy: [BLOCK_NUMBER_ASC]) {
          nodes {
            proposalId
            voteDeadline
          }
        }
        allProposalExecuteds(filter: {projectId: {equalTo: $projectId}}) {
          nodes {
            proposalId
            passed
          }
        }
      }`;

      const response = await fetch(GRAPHQL_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: GET_PROPOSALS,
          variables: { projectId },
        }),
      });

      const { data } = await response.json();

      // 处理已执行提案
      const executedProposals = new Set(
        data?.allProposalExecuteds?.nodes?.map((n: any) =>
          n.proposalId.toString()
        ) || []
      );

      // 获取所有提案并标记执行状态
      const proposals =
        data?.allProposalCreateds?.nodes?.map((proposal: any) => {
          const executedProposal = data?.allProposalExecuteds?.nodes?.find(
            (n: any) =>
              n.proposalId.toString() === proposal.proposalId.toString()
          );

          return {
            id: proposal.proposalId.toString(),
            deadline: Number(proposal.voteDeadline) * 1000,
            executed: executedProposals.has(proposal.proposalId.toString()),
            passed: executedProposal?.passed || false, // 从执行记录获取实际结果
          };
        }) || [];

      // 更新提案状态到组件
      setProposals(proposals);
    } catch (err) {
      toast.error("获取提案数据失败");
      console.error("Fetch proposals error:", err);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    // 仅在以下情况执行数据获取：
    // 1. 项目ID变化时（用户切换项目）
    // 2. 完成状态变为 true 时（交易确认成功）
    // 3. 捐赠确认成功时（isConfirmed 变化）
    fetchProject();
    fetchProposal();
  }, [projectId, isCompleted, isConfirmed]);
  if (loading) {
    return <div className="container mx-auto px-4 py-8">加载中...</div>;
  }

  if (error || !project) {
    return (
      <div className="container mx-auto px-4 py-8 text-red-500">
        {error || "项目数据异常"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-2 py-4">
      <div className="container mx-auto">
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="flex-1 flex justify-end">
            <button>
              {address?.toLowerCase() === project.creator.toLowerCase() &&
                project.isSuccessful && (
                  <div className="h-full relative">
                    {proposals.length > 0 &&
                      !proposals[proposals.length - 1].executed && (
                        <div className="text-yellow-600 absolute -top-6 left-0 text-sm whitespace-nowrap">
                          存在未执行提案(ID:{" "}
                          {proposals[proposals.length - 1].id})
                        </div>
                      )}
                    <Link
                      href={`/project/${projectId}/proposals/create`}
                      className={`h-10 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded block text-center ${
                        proposals.length > 0 &&
                        !proposals[proposals.length - 1].executed
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      onClick={(e) => {
                        if (
                          proposals.length > 0 &&
                          !proposals[proposals.length - 1].executed
                        ) {
                          e.preventDefault();
                          toast.error("请先执行当前提案");
                        }
                      }}
                    >
                      创建新提案
                    </Link>
                  </div>
                )}
            </button>
          </div>
          <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">
            {project.name}
          </h1>
          <div className="space-y-4 text-left">
            <p>
              <span className="font-semibold text-gray-700">发起人：</span>{" "}
              {project.creator}
            </p>
            <p>
              <span className="font-semibold text-gray-700">
                部署交易哈希：
              </span>
              {project.txHash ? (
                <a
                  href={`https://etherscan.io/tx/${project.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 break-all"
                >
                  {project.txHash.slice(0, 6)}...{project.txHash.slice(-4)}
                </a>
              ) : (
                <span className="text-gray-500">未记录交易哈希</span>
              )}
            </p>
            <p>
              <span className="font-semibold text-gray-700">描述：</span>{" "}
              {project.description}
            </p>
            <p>
              <span className="font-semibold text-gray-700">目标金额：</span>{" "}
              {formatETH(project.goal)} ETH
            </p>
            <p>
              <span className="font-semibold text-gray-700">当前金额：</span>{" "}
              {formatETH(project.currentAmount)} ETH
            </p>
            <p>
              <span className="font-semibold text-gray-700">总捐赠金额：</span>{" "}
              {formatETH(project.totalAmount)} ETH
            </p>
            <p>
              <span className="font-semibold text-gray-700">已提取金额：</span>{" "}
              {formatETH(project.totalWithdrawn)} ETH
            </p>
            <p>
              <span className="font-semibold text-gray-700">
                最大允许提取金额：
              </span>{" "}
              {formatETH(project.allowance)} ETH
            </p>
            <div className="mt-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-blue-700">
                  筹款进度
                </span>
                <span className="text-sm font-medium text-blue-700">
                  {(
                    (Number(project.totalAmount) / Number(project.goal)) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full">
                <div
                  className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      (Number(project.totalAmount) / Number(project.goal)) *
                        100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
            <p>
              <span className="font-semibold text-gray-700">截止时间：</span>{" "}
              {new Date(Number(project.deadline) * 1000).toLocaleString()}
            </p>
            <p>
              <span className="font-semibold text-gray-700">状态：</span>{" "}
              {project.completed
                ? project.isSuccessful
                  ? "✅ 成功"
                  : "❌ 失败"
                : "⏳ 进行中"}
            </p>
          </div>
          <div className="mt-8 bg-gray-50 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">支持这个项目</h2>
            <form onSubmit={handleDonate} className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  placeholder="输入捐赠金额 (ETH)"
                  className="flex-1 p-2 border rounded"
                  disabled={isWriting || isConfirming || project.completed}
                />
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded disabled:opacity-50"
                  disabled={
                    !donationAmount ||
                    isWriting ||
                    isConfirming ||
                    project.completed ||
                    Number(donationAmount) <= 0
                  }
                >
                  {isWriting
                    ? "签名中..."
                    : isConfirming
                    ? "确认中..."
                    : "立即捐赠"}
                </button>
              </div>

              {writeError && (
                <div className="text-red-500 text-sm">
                  错误：{writeError.message}
                </div>
              )}

              {isConfirmed && (
                <div className="text-green-600 text-sm">
                  捐赠成功！交易哈希：{hash?.slice(0, 12)}...
                </div>
              )}

              {project.completed && (
                <div className="mt-4 text-yellow-600">
                  该项目已结束，无法继续捐赠
                </div>
              )}
            </form>
          </div>
          <div className="mt-6 flex justify-center gap-4 items-stretch">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors h-full"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              返回
            </button>

            <button
              onClick={handleCompleteProject}
              disabled={isCompleting || project.completed}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50 h-full"
            >
              {isCompleting ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  提交中...
                </>
              ) : (
                "结束项目"
              )}
            </button>
          </div>
          <div className="mt-4 text-center">
            {completeError && (
              <div className="text-red-500 text-sm">
                结束失败：{completeError.message}
              </div>
            )}

            {isCompletingConfirming && (
              <div className="text-blue-500 text-sm">
                交易确认中... 哈希：{completeHash?.slice(0, 10)}...
              </div>
            )}

            {isCompleted && (
              <div className="text-green-500 text-sm">
                项目已成功结束！正在刷新数据...
              </div>
            )}
          </div>
          <div className="mt-8 bg-gray-50 p-6 rounded-lg">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowDonations(!showDonations)}
            >
              <h2 className="text-xl font-bold mb-4">捐赠记录</h2>
              <ChevronRightIcon
                className={`w-5 h-5 transition-transform ${
                  showDonations ? "transform rotate-90" : ""
                }`}
              />
            </div>
            {showDonations && (
              <div className="mt-4">
                {donations.length > 0 ? (
                  <div className="space-y-2">
                    {donations.map((donation, index) => (
                      <div
                        key={index}
                        className="bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-200 ease-in-out"
                      >
                        <div
                          className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                          onClick={() => toggleDonation(index)}
                        >
                          <div className="flex items-center space-x-3">
                            <ChevronRightIcon
                              className={`w-4 h-4 transition-transform ${
                                expandedDonations.has(index)
                                  ? "transform rotate-90"
                                  : ""
                              }`}
                            />
                            <span className="font-medium text-gray-600">
                              {`${donation.donor.slice(
                                0,
                                6
                              )}...${donation.donor.slice(-4)}`}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="text-blue-600 font-semibold">
                              总捐赠金额：
                              {formatETH(
                                BigInt(donation.amount)
                              ).toString()}{" "}
                              ETH
                            </span>
                          </div>
                        </div>

                        {expandedDonations.has(index) && (
                          <div className="p-3 bg-gray-50 border-t animate-slideDown">
                            <div className="text-sm space-y-2">
                              <div className="flex flex-col">
                                <span className="text-gray-500 mb-1">
                                  完整地址：
                                </span>
                                <a
                                  href={`https://etherscan.io/address/${donation.donor}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-600 break-all"
                                >
                                  {donation.donor}
                                </a>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-gray-500 mb-1">
                                  交易哈希：
                                </span>
                                <a
                                  href={`https://etherscan.io/tx/${donation.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-600 break-all"
                                >
                                  {donation.txHash}
                                </a>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-4">
                    暂无捐赠记录
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="mt-8 bg-gray-50 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">资金操作</h2>
            {project.completed &&
              project.isSuccessful &&
              address?.toLowerCase() === project.creator.toLowerCase() && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder={`可提取额度：${formatETH(
                        project.allowance - project.totalWithdrawn
                      )} ETH`}
                      className="flex-1 p-2 border rounded"
                      disabled={isWithdrawLoading}
                    />
                    <button
                      onClick={() =>
                        handleFundsOperation("withdraw", withdrawAmount)
                      }
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded disabled:opacity-50"
                      disabled={
                        !withdrawAmount ||
                        isWithdrawLoading ||
                        Number(withdrawAmount) <= 0
                      }
                    >
                      {isWithdrawLoading ? "处理中..." : "提取资金"}
                    </button>
                  </div>
                  {withdrawError && (
                    <div className="text-red-500 text-sm">{withdrawError}</div>
                  )}
                </div>
              )}

            {project.completed && !project.isSuccessful && (
              <button
                onClick={() => handleFundsOperation("refund")}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded w-full"
                disabled={isWithdrawLoading}
              >
                {isWithdrawLoading ? "处理中..." : "申请退款"}
              </button>
            )}
          </div>
          <div className="mt-8 bg-gray-50 p-6 rounded-lg">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowProposals(!showProposals)} // 需要添加状态: const [showProposals, setShowProposals] = useState(false);
            >
              <h2 className="text-xl font-bold mb-4">提案记录</h2>
              <ChevronRightIcon
                className={`w-5 h-5 transition-transform ${
                  showProposals ? "transform rotate-90" : ""
                }`}
              />
            </div>
            {showProposals && (
              <div className="mt-4">
                {proposals.length > 0 ? (
                  <div className="space-y-2">
                    {proposals.map((proposal) => (
                      <Link
                        key={proposal.id}
                        href={`/project/${projectId}/proposals/${proposal.id}`}
                        className="bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-200 ease-in-out hover:shadow-md"
                      >
                        <div className="p-3 flex justify-between items-center">
                          <div className="flex items-center space-x-3">
                            {/* 新增状态徽章 */}
                            <span
                              className={`px-2 py-1 rounded-full text-sm ${
                                proposal.executed
                                  ? proposal.passed
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {proposal.executed
                                ? proposal.passed
                                  ? "已通过"
                                  : "未通过"
                                : "未执行"}
                            </span>
                            <span className="font-medium text-gray-600">
                              提案ID: {proposal.id}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="text-blue-600 font-semibold">
                              截止时间:{" "}
                              {new Date(proposal.deadline).toLocaleString()}
                            </span>
                            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-4">
                    暂无提案记录
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
