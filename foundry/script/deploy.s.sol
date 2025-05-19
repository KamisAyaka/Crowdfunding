// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {Crowdfunding} from "../src/Crowdfunding.sol";
import {CrowdfundingNFT} from "../src/CrowdfundingNFT.sol";
import {ProposalGovernance} from "../src/ProposalGovernance.sol";

contract DeployScript is Script {
    function run() external {
        // 获取部署者地址
        address deployer = msg.sender;

        // 部署流程
        vm.startBroadcast(deployer);

        // 1. 部署NFT合约
        CrowdfundingNFT nft = new CrowdfundingNFT();
        console.log("CrowdfundingNFT deployed at:", address(nft));

        // 2. 部署众筹主合约
        Crowdfunding crowdfunding = new Crowdfunding();
        console.log("Crowdfunding deployed at:", address(crowdfunding));

        // 3. 部署提案治理合约
        ProposalGovernance proposalGov = new ProposalGovernance(
            address(crowdfunding)
        );
        console.log("ProposalGovernance deployed at:", address(proposalGov));

        // 配置合约间关系
        // 设置NFT合约的铸造权限
        // 设置众筹合约的NFT地址
        crowdfunding.setNFTContractAddress(address(nft));
        // 设置NFT合约的owner为众筹合约
        nft.transferOwnership(address(crowdfunding));

        // 设置提案合约地址
        crowdfunding.setProposalAddress(address(proposalGov));

        vm.stopBroadcast();

        // 输出最终配置
        console.log("\nFinal Configuration:");
        console.log("Crowdfunding NFT Address:", address(nft));
        console.log("Proposal Governance Address:", address(proposalGov));
    }
}
