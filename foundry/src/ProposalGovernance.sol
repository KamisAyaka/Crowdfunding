// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ICrowdfunding.sol";

contract ProposalGovernance is Ownable {
    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/
    struct Proposal {
        uint projectId;
        uint proposalId;
        string description; // 提案描述
        uint amount; // 请求拨款金额
        uint voteDeadline; // 投票截止时间戳
        bool executed; // 是否已执行
        bool passed; // 是否通过
        uint yesVotesAmount; // 支持金额总量
        uint noVotesAmount;
        mapping(address => bool) hasVoted; // 每个地址是否已投票
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    // 每个项目下的提案列表
    mapping(uint => Proposal[]) public projectProposals;

    // 每个项目的提案失败次数计数器
    mapping(uint => uint) public proposalFailureCount;

    // Crowdfunding 主合约地址
    address public crowdfundingAddress;

    /*//////////////////////////////////////////////////////////////
                               EVENTS
    //////////////////////////////////////////////////////////////*/
    event ProposalCreated(
        uint indexed projectId,
        uint indexed proposalId,
        string description,
        uint amount,
        uint voteDeadline
    );

    event Voted(
        uint indexed projectId,
        uint indexed proposalId,
        address indexed voter,
        bool support,
        uint amount
    );

    event ProposalExecuted(
        uint indexed projectId,
        uint indexed proposalId,
        bool passed
    );

    /*//////////////////////////////////////////////////////////////
                             MAIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    constructor(address _crowdfundingAddress) Ownable(_crowdfundingAddress) {
        crowdfundingAddress = _crowdfundingAddress;
    }

    /**
     * @dev 创建提案
     */
    function createProposal(
        uint _projectId,
        uint _amount,
        uint _voteDurationDays,
        string memory _description
    ) external {
        require(
            projectProposals[_projectId].length == 0 ||
                projectProposals[_projectId][
                    projectProposals[_projectId].length - 1
                ].executed,
            "Previous proposal not executed"
        );
        require(
            _voteDurationDays > 0 && _voteDurationDays <= 7,
            "Vote duration must be 1-7 days"
        );

        // 解构获取项目信息
        (
            ,
            address payable creator,
            ,
            ,
            ,
            ,
            ,
            uint totalAmount,
            uint allowence,
            ,
            bool isSuccessful
        ) = ICrowdfunding(crowdfundingAddress).projects(_projectId);
        require(
            msg.sender == creator,
            "Only project creator can create proposal"
        );
        require(isSuccessful, "Project is not successful");
        require(
            totalAmount - allowence >= _amount,
            "Requested amount exceeds available funds"
        );

        uint deadline = block.timestamp + (_voteDurationDays * 1 days); // 1 day = 86400 seconds

        Proposal storage newProposal = projectProposals[_projectId].push();
        newProposal.projectId = _projectId;
        newProposal.proposalId = projectProposals[_projectId].length - 1;
        newProposal.description = _description;
        newProposal.amount = _amount;
        newProposal.voteDeadline = deadline;
        newProposal.executed = false;

        emit ProposalCreated(
            _projectId,
            newProposal.proposalId,
            _description,
            _amount,
            deadline
        );
    }

    /**
     * @dev 投票
     */
    function voteOnProposal(
        uint _projectId,
        uint _proposalId,
        bool _support
    ) external {
        Proposal storage proposal = projectProposals[_projectId][_proposalId];
        require(
            block.timestamp <= proposal.voteDeadline,
            "Voting period has ended"
        );
        require(!proposal.hasVoted[msg.sender], "Already voted");

        uint donationAmount = ICrowdfunding(crowdfundingAddress).donorAmounts(
            msg.sender,
            _projectId
        );
        require(donationAmount > 0, "No donation balance to vote");

        if (_support) {
            proposal.yesVotesAmount += donationAmount;
        } else {
            proposal.noVotesAmount += donationAmount;
        }

        proposal.hasVoted[msg.sender] = true;

        emit Voted(
            _projectId,
            _proposalId,
            msg.sender,
            _support,
            donationAmount
        );
    }

    /**
     * @dev 执行提案
     */
    function executeProposal(uint _projectId, uint _proposalId) external {
        Proposal storage proposal = projectProposals[_projectId][_proposalId];
        require(
            block.timestamp > proposal.voteDeadline,
            "Voting period not ended"
        );
        require(!proposal.executed, "Proposal already executed");

        uint totalVotes = proposal.yesVotesAmount + proposal.noVotesAmount;

        if (
            totalVotes > 0 && (proposal.yesVotesAmount * 100) / totalVotes >= 60
        ) {
            // 成功
            proposal.passed = true;
            ICrowdfunding(crowdfundingAddress).increaseAllowence(
                _projectId,
                proposal.amount
            );
            proposalFailureCount[_projectId] = 0; // 重置失败计数
        } else {
            // 失败
            proposalFailureCount[_projectId] += 1;

            if (proposalFailureCount[_projectId] >= 3) {
                ICrowdfunding(crowdfundingAddress).setProjectFailed(_projectId);
            }
        }

        proposal.executed = true;

        emit ProposalExecuted(_projectId, _proposalId, proposal.passed);
    }

    function getProjectProposals(
        uint _projectId
    )
        external
        view
        returns (
            uint[] memory proposalIds,
            uint[] memory amounts,
            uint[] memory deadlines,
            bool[] memory executedStatus
        )
    {
        Proposal[] storage proposals = projectProposals[_projectId];

        proposalIds = new uint[](proposals.length);
        amounts = new uint[](proposals.length);
        deadlines = new uint[](proposals.length);
        executedStatus = new bool[](proposals.length);

        for (uint i = 0; i < proposals.length; i++) {
            proposalIds[i] = proposals[i].proposalId;
            amounts[i] = proposals[i].amount;
            deadlines[i] = proposals[i].voteDeadline;
            executedStatus[i] = proposals[i].executed;
        }
    }
}
