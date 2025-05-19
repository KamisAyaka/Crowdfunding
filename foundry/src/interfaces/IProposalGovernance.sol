// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IProposalGovernance {
    struct Proposal {
        uint projectId;
        uint proposalId;
        string description; // 提案描述
        uint amount; // 请求拨款金额
        uint voteDeadline; // 投票截止时间戳
        bool executed; // 是否已执行
        bool passed; // 是否通过
        uint yesVotesAmount; // 支持金额总量
        uint noVotesAmount; // 反对金额总量
        mapping(address => bool) hasVoted; // 每个地址是否已投票
    }

    function createProposal(
        uint _projectId,
        uint _amount,
        uint _voteDurationDays,
        string memory _description
    ) external;

    function voteOnProposal(
        uint _projectId,
        uint _proposalId,
        bool _support
    ) external;

    function executeProposal(uint _projectId, uint _proposalId) external;
}
