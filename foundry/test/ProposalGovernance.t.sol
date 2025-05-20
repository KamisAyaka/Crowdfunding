// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/Crowdfunding.sol";
import "../src/ProposalGovernance.sol";
import "../src/CrowdfundingNFT.sol";

contract ProposalGovernanceTest is Test {
    Crowdfunding public crowdfunding;
    ProposalGovernance public proposalGov;
    CrowdfundingNFT public nft;
    address public nftContract = address(0x123);
    address public owner = address(1);
    address public creator = address(2);
    address public voter1 = address(3);
    address public voter2 = address(4);

    function setUp() public {
        // 部署合约
        vm.startPrank(owner);
        crowdfunding = new Crowdfunding();
        nft = new CrowdfundingNFT();
        crowdfunding.setNFTContractAddress(address(nft)); // 设置NFT合约地址
        // 设置NFT合约的owner为众筹合约
        nft.transferOwnership(address(crowdfunding));
        proposalGov = new ProposalGovernance(address(crowdfunding));
        crowdfunding.setProposalAddress(address(proposalGov));
        vm.stopPrank();

        // 创建测试项目
        vm.prank(creator);
        crowdfunding.createProject(
            "Test Project",
            "Test Desc",
            10 ether,
            block.timestamp + 1 days
        );
    }

    // 测试提案创建和执行流程
    function testProposalWorkflow() public {
        // 完成项目筹款
        _fundAndCompleteProject();

        // 创建提案
        vm.prank(creator);
        proposalGov.createProposal(0, 5 ether, 1, "Test Proposal");

        // 投票
        _vote(0, 0, true, voter1);
        _vote(0, 0, true, voter2);

        // 执行提案
        vm.warp(block.timestamp + 2 days);
        vm.prank(creator);
        proposalGov.executeProposal(0, 0);

        // 验证结果
        (, , , , , , , , uint allowence, , ) = crowdfunding.projects(0);
        assertEq(allowence, 2.5 ether + 5 ether); // 初始25% + 新增5 ETH
    }

    // 测试三次失败提案触发退款
    function testThreeFailedProposals() public {
        _fundAndCompleteProject();
        uint start = block.timestamp;

        // 连续创建三个失败提案
        for (uint i = 0; i < 3; i++) {
            vm.prank(creator);
            proposalGov.createProposal(0, 5 ether, 1, "Test Proposal");

            _vote(0, i, false, voter1);
            _vote(0, i, false, voter2);
            start += 2 days;

            vm.warp(start);
            vm.prank(creator);
            proposalGov.executeProposal(0, i);
        }

        // 验证项目状态
        (, , , , , , , , , , bool isSuccessful) = crowdfunding.projects(0);
        assertFalse(isSuccessful);
    }

    // 辅助函数：完成项目筹款
    function _fundAndCompleteProject() private {
        // 捐赠资金
        vm.deal(voter1, 10 ether);
        vm.prank(voter1);
        crowdfunding.donate{value: 8 ether}(0);

        vm.deal(voter2, 10 ether);
        vm.prank(voter2);
        crowdfunding.donate{value: 2 ether}(0);

        // 结束项目
        vm.warp(block.timestamp + 2 days);
        vm.prank(creator);
        crowdfunding.completeProject(0);
    }

    // 辅助函数：模拟投票
    function _vote(
        uint projectId,
        uint proposalId,
        bool support,
        address voter
    ) private {
        vm.prank(voter);
        proposalGov.voteOnProposal(projectId, proposalId, support);
    }
}
