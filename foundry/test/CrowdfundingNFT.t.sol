// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {CrowdfundingNFT} from "../src/CrowdfundingNFT.sol";

contract CrowdfundingNFTTest is StdCheats, Test {
    CrowdfundingNFT nft;
    address owner = address(0x123);
    address user = address(0x456);

    function setUp() public {
        vm.startPrank(owner);
        nft = new CrowdfundingNFT();
        vm.stopPrank();
    }

    // 测试只有 owner 可以铸造 NFT
    function test_OnlyOwnerCanMint() public {
        vm.expectRevert();
        nft.mintNFT(user, 1, 1, 1 ether); // 非 owner 调用应该失败
    }

    // 测试 NFT 铸造流程
    function test_NFTMinting() public {
        vm.startPrank(owner);
        uint256 tokenId = nft.mintNFT(user, 1, 1, 1 ether);

        // 验证基础信息
        assertEq(nft.ownerOf(tokenId), user);
        assertEq(nft.getTokenIdCounter(), 1);

        // 验证捐赠信息
        (address donor, uint256 projectId, uint256 rank, uint256 amount) = nft
            .getNFTInfo(tokenId);
        assertEq(donor, user);
        assertEq(projectId, 1);
        assertEq(rank, 1);
        assertEq(amount, 1 ether);
    }

    // 测试颜色生成逻辑
    function test_ColorGeneration() public view {
        string memory color = nft.generateColorFromSeed(12345);
        assertEq(bytes(color).length, 7); // # + 6位hex
        assertTrue(startsWith(color, "#"));
    }

    // 辅助函数：检查字符串前缀
    function startsWith(
        string memory str,
        string memory prefix
    ) private pure returns (bool) {
        bytes memory strBytes = bytes(str);
        bytes memory prefixBytes = bytes(prefix);
        if (prefixBytes.length > strBytes.length) return false;
        for (uint i = 0; i < prefixBytes.length; i++) {
            if (strBytes[i] != prefixBytes[i]) return false;
        }
        return true;
    }
}
