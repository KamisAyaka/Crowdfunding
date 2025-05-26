"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { chainsToContracts, ProposalGovernanceAbi } from "@/constants";
import Link from "next/link";
import { parseEther } from "viem";
import toast from "react-hot-toast";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";

export default function CreateProposalPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { address } = useAccount();
  const chainId = useChainId();

  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    durationDays: 1, // 默认3天
  });

  const { writeContract, isPending, error } = useWriteContract();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    try {
      writeContract({
        address: chainsToContracts[chainId].ProposalGovernance as `0x${string}`,
        abi: ProposalGovernanceAbi,
        functionName: "createProposal",
        args: [
          BigInt(projectId),
          parseEther(formData.amount),
          formData.durationDays,
          formData.description,
        ],
      });
      toast.success("提案已提交");
    } catch (err) {
      toast.error(
        `创建失败: ${err instanceof Error ? err.message : "未知错误"}`
      );
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">创建资金使用提案</h1>
        <Link
          href={`/project/${projectId}`}
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          返回项目
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            申请金额 (ETH)
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            className="w-full p-3 border rounded-lg"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">提案描述</label>
          <textarea
            required
            className="w-full p-3 border rounded-lg h-32"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            投票期限（天）
            <span className="ml-2 text-blue-500">
              {formData.durationDays} 天
            </span>
          </label>
          <input
            type="range"
            min="1"
            max="7"
            required
            className="w-full range range-primary"
            value={formData.durationDays}
            onChange={(e) =>
              setFormData({
                ...formData,
                durationDays: Number(e.target.value),
              })
            }
          />
          <div className="flex justify-between text-xs px-2">
            {[...Array(7)].map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-purple-600 text-white p-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
        >
          {isPending ? "提交中..." : "创建提案"}
        </button>
      </form>
    </div>
  );
}
