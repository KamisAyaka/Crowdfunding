import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useReadContract, useChainId } from "wagmi";
import { CrowdfundingNFTAbi, chainsToContracts } from "../constants";

// Type for the NFT data
interface NFTBoxProps {
  tokenId: string;
  projectId: string;
  rank: number;
  donationAmount: string;
}

export default function NFTBox({
  tokenId,
  projectId,
  rank,
  donationAmount,
}: NFTBoxProps) {
  const [nftImageUrl, setNftImageUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [imageError, setImageError] = useState(false);

  const chainId = useChainId();
  const currentChainContracts = chainsToContracts[chainId];
  const contractAddress = currentChainContracts?.CrowdfundingNFT;

  // Fetch the tokenURI from the contract
  const {
    data: tokenURIData,
    isLoading: isTokenURILoading,
    error: tokenURIError,
  } = useReadContract({
    abi: CrowdfundingNFTAbi,
    address: contractAddress as `0x${string}`,
    functionName: "tokenURI",
    args: [tokenId ? BigInt(tokenId) : undefined],
    query: {
      enabled: !!tokenId && !!contractAddress,
    },
  });

  // Fetch the metadata and extract image URL when tokenURI is available
  useEffect(() => {
    if (tokenURIData && !isTokenURILoading) {
      const fetchMetadata = async () => {
        setIsLoadingImage(true);
        try {
          // 直接解析base64数据
          const [header, base64Data] = (tokenURIData as string).split(",");

          const jsonString = atob(base64Data);
          const metadata = JSON.parse(jsonString);

          setNftImageUrl(metadata.image); // 直接使用image字段
        } catch (error) {
          console.error("元数据解析错误:", error);
          setImageError(true);
        } finally {
          setIsLoadingImage(false);
        }
      };

      fetchMetadata();
    }
  }, [tokenURIData, isTokenURILoading]);

  return (
    <div className="border rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow">
      <div className="aspect-square relative bg-gray-100">
        {isLoadingImage || isTokenURILoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="animate-pulse">Loading...</span>
          </div>
        ) : imageError || tokenURIError || !nftImageUrl ? (
          // Fallback to local placeholder when there's an error
          <Image
            src="/github_image.png"
            alt={`NFT ${tokenId}`}
            fill
            className="object-cover"
          />
        ) : (
          //Display the actual NFT image
          <Image
            src={nftImageUrl}
            alt={`NFT ${tokenId}`}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
          />
        )}
      </div>
      <div className="p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold">Token #{tokenId}</h3>
          <span className="text-sm bg-gray-100 px-2 py-1 rounded">
            排名 #{rank}
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-sm">项目ID: {projectId}</p>
          <p className="text-sm">
            捐赠金额: {Number(donationAmount) / 1e18} ETH
          </p>
          <p
            className="text-sm text-gray-600 break-all"
            title={contractAddress}
          >
            合约地址: {contractAddress.slice(0, 6)}...
            {contractAddress.slice(-4)}
          </p>
        </div>
      </div>
    </div>
  );
}
