// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/Crowdfunding.sol";
import "../src/CrowdfundingNFT.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

contract CrowdfundingTest is Test {
    Crowdfunding public crowdfunding;
    CrowdfundingNFT public nft;
    address public creator = address(0x123);
    address[6] public donors = [
        address(0x1),
        address(0x2),
        address(0x3),
        address(0x4),
        address(0x5),
        address(0x6)
    ];

    uint64[6] public amounts = [
        3 ether,
        2 ether,
        1.5 ether,
        1 ether,
        0.5 ether,
        2.3 ether
    ];
    address public nftAddress = address(0x999);

    // 设置测试环境
    function setUp() public {
        // 创建众筹合约实例
        crowdfunding = new Crowdfunding();
        // 部署NFT合约并设置地址
        nft = new CrowdfundingNFT();
        vm.prank(crowdfunding.owner());
        crowdfunding.setNFTContractAddress(address(nft));
        // 设置NFT合约的owner为众筹合约
        vm.prank(nft.owner());
        nft.transferOwnership(address(crowdfunding));

        // 为捐赠者地址分配资金
        for (uint i = 0; i < 6; i++) {
            vm.deal(donors[i], amounts[i]);
        }
    }

    modifier setupProject() {
        vm.prank(creator);
        crowdfunding.createProject(
            "Test Project",
            "Description",
            1 ether,
            block.timestamp + 7 days
        );
        _;
    }

    // 测试项目创建功能
    function testCreateProject() public setupProject {
        // 检查项目数量增加到1
        assertEq(crowdfunding.getProjectCount(), 1);

        // 检查项目信息
        (
            uint id,
            address payable creatorAddr,
            string memory name,
            string memory description,
            uint goal,
            ,
            uint currentAmount,
            uint totalAmount,
            uint allowence,
            bool completed,
            bool isSuccessful
        ) = crowdfunding.getProjectInfo(0);

        assertEq(id, 0);
        assertEq(creatorAddr, creator);
        assertEq(name, "Test Project");
        assertEq(description, "Description");
        assertEq(goal, 1 ether);
        assertEq(currentAmount, 0);
        assertEq(totalAmount, 0);
        assertEq(allowence, 0);
        assertEq(completed, false);
        assertEq(isSuccessful, false);
    }

    // 测试资金捐赠功能
    function testDonate() public setupProject {
        // 捐赠资金
        vm.prank(donors[1]);
        (bool success, ) = address(crowdfunding).call{value: 0.5 ether}(
            abi.encodeWithSignature("donate(uint256)", 0)
        );
        assertTrue(success);

        // 检查当前筹款金额
        (, , , , , , uint currentAmount, , , , ) = crowdfunding.getProjectInfo(
            0
        );

        assertEq(currentAmount, 0.5 ether);

        // 检查捐赠者余额
        assertEq(crowdfunding.donorAmounts(donors[1], 0), 0.5 ether);
    }

    // 测试多个捐赠者
    function testMultipleDonations() public setupProject {
        // 第一个捐赠者
        vm.prank(donors[1]);
        (bool success1, ) = address(crowdfunding).call{value: 0.5 ether}(
            abi.encodeWithSignature("donate(uint256)", 0)
        );
        assertTrue(success1);

        // 第二个捐赠者
        vm.prank(donors[2]);
        (bool success2, ) = address(crowdfunding).call{value: 0.7 ether}(
            abi.encodeWithSignature("donate(uint256)", 0)
        );
        assertTrue(success2);

        // 检查当前筹款金额
        (, , , , , , uint currentAmount, , , , ) = crowdfunding.getProjectInfo(
            0
        );

        assertEq(currentAmount, 1.2 ether);

        // 检查捐赠者余额
        assertEq(crowdfunding.donorAmounts(donors[1], 0), 0.5 ether);
        assertEq(crowdfunding.donorAmounts(donors[2], 0), 0.7 ether);
    }

    // 测试筹款成功
    function testFundingSuccess() public setupProject {
        // 捐赠达到目标金额
        vm.prank(donors[1]);
        (bool success, ) = address(crowdfunding).call{value: 1 ether}(
            abi.encodeWithSignature("donate(uint256)", 0)
        );
        assertTrue(success);

        // 检查项目状态（尚未完成）
        (
            ,
            ,
            ,
            ,
            ,
            ,
            uint currentAmount,
            ,
            ,
            bool completed,
            bool isSuccessful
        ) = crowdfunding.getProjectInfo(0);

        assertEq(currentAmount, 1 ether);
        assertEq(completed, false);
        assertEq(isSuccessful, false);

        // 完成项目
        vm.warp(block.timestamp + 8 days); // 增加时间超过截止日期
        address[] memory recipients = new address[](1);
        recipients[0] = donors[1];
        uint[] memory amount = new uint[](2);
        amount[0] = 1 ether;
        vm.prank(creator);
        crowdfunding.completeProject(0, recipients, amount);
        // 检查项目状态
        (, , , , , , currentAmount, , , completed, isSuccessful) = crowdfunding
            .getProjectInfo(0);

        assertEq(currentAmount, 1 ether);
        assertEq(completed, true);
        assertEq(isSuccessful, true);

        // 提取资金
        uint initialBalance = creator.balance;
        vm.prank(creator); // 使用creator调用提取资金函数
        crowdfunding.withdrawFunds(0, (currentAmount * 25) / 100);
        assertTrue(creator.balance > initialBalance);
    }

    // 测试筹款失败
    function testFundingFailure() public setupProject {
        // 捐赠部分金额
        vm.prank(donors[1]);
        (bool success, ) = address(crowdfunding).call{value: 0.5 ether}(
            abi.encodeWithSignature("donate(uint256)", 0)
        );
        assertTrue(success);

        // 完成项目
        vm.warp(block.timestamp + 8 days); // 增加时间超过截止日期
        address[] memory recipients = new address[](1);
        recipients[0] = donors[1];
        uint[] memory amount = new uint[](2);
        amount[0] = 0.5 ether;
        vm.prank(creator);
        crowdfunding.completeProject(0, recipients, amount);

        // 检查项目状态
        (
            ,
            ,
            ,
            ,
            ,
            ,
            uint currentAmount,
            ,
            ,
            bool completed,
            bool isSuccessful
        ) = crowdfunding.getProjectInfo(0);

        assertEq(currentAmount, 0.5 ether);
        assertEq(completed, true);
        assertEq(isSuccessful, false);

        // 检查退款
        uint initialBalance = donors[1].balance;
        vm.prank(donors[1]);
        crowdfunding.refund(0);
        assertTrue(donors[1].balance > initialBalance);
    }
}
