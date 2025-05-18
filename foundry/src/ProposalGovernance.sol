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
        uint amount; // 请求拨款金额
        uint voteDeadline; // 投票截止时间戳
        bool executed; // 是否已执行
        bool passed; // 是否通过
        uint yesVotesAmount; // 支持金额总量
        uint noVotesAmount; // 反对金额总量
        mapping(address => bool) hasVoted; // 每个地址是否已投票
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    // 每个项目下的提案列表
    mapping(uint => Proposal[]) public projectProposals;

    // 每个项目的提案失败次数计数器
    mapping(uint => uint) public proposalFailureCount;

    // 标记项目是否已经发放过初始25%资金
    mapping(uint => bool) public initialFundsWithdrawn;

    // 标记是否允许退款（三次提案失败后）
    mapping(uint => bool) public refundAllowed;

    // Crowdfunding 主合约地址
    address public crowdfundingAddress;

    /*//////////////////////////////////////////////////////////////
                               EVENTS
    //////////////////////////////////////////////////////////////*/
    event ProposalCreated(
        uint indexed projectId,
        uint indexed proposalId,
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

    event RefundEnabled(uint indexed projectId);

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier onlyCrowdfundingOwner() {
        require(
            msg.sender == crowdfundingAddress,
            "Caller is not the crowdfunding owner"
        );
        _;
    }

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
        uint _voteDurationDays
    ) external onlyCrowdfundingOwner {
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
            uint currentAmount,
            bool completed,
            bool isSuccessful
        ) = ICrowdfunding(crowdfundingAddress).projects(_projectId);

        require(isSuccessful, "Project is not successful");
        require(
            !initialFundsWithdrawn[_projectId],
            "Initial funds already withdrawn"
        );

        uint deadline = block.timestamp + (_voteDurationDays * 1 days); // 1 day = 86400 seconds

        Proposal storage newProposal = projectProposals[_projectId].push();
        newProposal.projectId = _projectId;
        newProposal.proposalId = projectProposals[_projectId].length - 1;
        newProposal.amount = _amount;
        newProposal.voteDeadline = deadline;
        newProposal.executed = false;

        emit ProposalCreated(
            _projectId,
            newProposal.proposalId,
            _amount,
            deadline
        );
    }

    /**
     * @dev 投票接口
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

        // 获取当前剩余资金用于判断投票权重
        (, , , , , uint currentAmount, , , , , ) = ICrowdfunding(
            crowdfundingAddress
        ).getProjectInfo(_projectId);

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

        // 获取当前剩余资金用于判断投票权重
        (, , , , , uint currentAmount, , , , , ) = ICrowdfunding(
            crowdfundingAddress
        ).getProjectInfo(_projectId);

        require(
            proposal.amount <= currentAmount,
            "Requested amount exceeds available funds"
        );

        if (proposal.yesVotesAmount > (currentAmount * 50) / 100) {
            // 成功
            // 解构获取项目创建人
            (, address payable creator, , , , , , , ) = ICrowdfunding(
                crowdfundingAddress
            ).projects(_projectId);

            payable(creator).transfer(proposal.amount);
            ICrowdfunding(crowdfundingAddress).updateCurrentAmount(
                _projectId,
                proposal.amount
            );

            proposal.passed = true;
            proposalFailureCount[_projectId] = 0; // 重置失败计数
        } else {
            // 失败
            proposalFailureCount[_projectId] += 1;

            if (proposalFailureCount[_projectId] >= 3) {
                refundAllowed[_projectId] = true;
                emit RefundEnabled(_projectId);
            }
        }

        proposal.executed = true;

        emit ProposalExecuted(_projectId, _proposalId, proposal.passed);
    }

    /**
     * @dev 允许捐赠者在提案失败三次后撤回资金
     */
    function refundAfterFailedProposals(uint _projectId) external {
        require(refundAllowed[_projectId], "Refund not allowed yet");

        uint amount = ICrowdfunding(crowdfundingAddress).donorAmounts(
            msg.sender,
            _projectId
        );
        require(amount > 0, "No balance to refund");

        ICrowdfunding(crowdfundingAddress).updateDonorBalance(
            _projectId,
            msg.sender,
            0
        );

        payable(msg.sender).transfer(amount);
    }

    /**
     * @dev 提案成功后发放初始资金
     */
    function withdrawInitialFunds(
        uint _projectId
    ) external onlyCrowdfundingOwner {
        require(
            !initialFundsWithdrawn[_projectId],
            "Initial funds already withdrawn"
        );

        (, , , , , uint currentAmount, , , , , ) = ICrowdfunding(
            crowdfundingAddress
        ).getProjectInfo(_projectId);
        uint initialAmount = (currentAmount * 25) / 100;

        // 获取项目创建人
        (, address payable creator, , , , , , , ) = ICrowdfunding(
            crowdfundingAddress
        ).projects(_projectId);

        payable(creator).transfer(initialAmount);
        ICrowdfunding(crowdfundingAddress).updateCurrentAmount(
            _projectId,
            initialAmount
        );

        initialFundsWithdrawn[_projectId] = true;
    }
}
