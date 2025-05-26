// 将wei单位转换为ETH（1 ETH = 1e18 wei）
export const formatETH = (wei: bigint | number | string) => {
  const value = typeof wei === "string" ? parseFloat(wei) : Number(wei);
  return (value / 1e18).toLocaleString("zh-CN", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
};

// 时间戳转中文时间格式
export const formatTime = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
};
