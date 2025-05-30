"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { chainsToContracts, CrowdfundingAbi } from "@/constants";
import { parseEther } from "viem";
import toast from "react-hot-toast";

export default function CreateProject() {
  const { address } = useAccount();
  const chainId = useChainId();
  const currentChainContracts = chainsToContracts[chainId];
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    goal: "",
    duration: 1, // 默认1天
  });

  // 合约写入操作
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  // 等待交易确认
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  // 实时显示截止时间
  const [deadlinePreview, setDeadlinePreview] = useState("");
  useEffect(() => {
    const calculateDeadline = () => {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const deadline = nowInSeconds + formData.duration * 86400;
      setDeadlinePreview(new Date(deadline * 1000).toLocaleString());
    };
    calculateDeadline();
    const interval = setInterval(calculateDeadline, 1000);
    return () => clearInterval(interval);
  }, [formData.duration]);

  const handleSubmit = async (e: React.FormEvent) => {
    if (!address) {
      toast.error("请先连接钱包");
      return;
    }

    try {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const deadlineTimestamp = nowInSeconds + formData.duration * 86400;

      writeContract({
        address: currentChainContracts.Crowdfunding as `0x${string}`,
        abi: CrowdfundingAbi,
        functionName: "createProject",
        args: [
          formData.name,
          formData.description,
          parseEther(formData.goal),
          deadlineTimestamp,
        ],
      });
    } catch (err) {
      console.error("创建项目失败:", err);
      toast.error(
        `参数错误: ${err instanceof Error ? err.message : "无效输入"}`
      );
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">创建新项目</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Project Name</label>
          <input
            type="text"
            required
            className="w-full p-3 border rounded-lg"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
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
            Funding Goal (ETH)
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            className="w-full p-3 border rounded-lg"
            value={formData.goal}
            onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Deadline
            <span className="ml-2 text-blue-500">{formData.duration} 天</span>
          </label>
          <input
            type="range"
            min="1"
            max="7"
            step="1"
            required
            className="w-full range range-primary"
            value={formData.duration}
            onChange={(e) =>
              setFormData({
                ...formData,
                duration: Number(e.target.value),
              })
            }
          />
          <div className="flex justify-between text-xs px-2">
            {[...Array(7)].map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <p className="text-sm">预计截止时间：{deadlinePreview}</p>
        </div>

        <button
          type="submit"
          disabled={isPending || isConfirming}
          className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
        >
          {isPending ? "签名中..." : isConfirming ? "确认中..." : "创建项目"}
        </button>
      </form>
    </div>
  );
}
