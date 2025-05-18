// ICrowdfundingNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICrowdfundingNFT {
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    event CreatedNFT(uint256 indexed tokenId);

    /*//////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/
    struct DonationInfo {
        uint projectId;
        uint donationAmount;
        uint rank;
    }

    /*//////////////////////////////////////////////////////////////
                                FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function mintNFT(
        address to,
        uint projectId,
        uint rank,
        uint donationAmount
    ) external returns (uint256);

    function getNFTInfo(
        uint tokenId
    ) external view returns (uint projectId, uint rank, uint donationAmount);

    function getTokenIdCounter() external view returns (uint256);

    function tokenURI(uint256 tokenId) external view returns (string memory);

    // ERC721 基础函数
    function ownerOf(uint256 tokenId) external view returns (address);

    function approve(address to, uint256 tokenId) external;

    function transferFrom(address from, address to, uint256 tokenId) external;

    // Ownable 相关函数
    function owner() external view returns (address);

    function transferOwnership(address newOwner) external;
}
