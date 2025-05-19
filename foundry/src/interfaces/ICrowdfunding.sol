// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICrowdfunding {
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event ProjectCreated(
        uint indexed id,
        address indexed creator,
        string name,
        uint goal,
        uint deadline
    );

    event DonationMade(
        uint indexed projectId,
        address indexed donor,
        uint amount
    );

    event ProjectCompleted(uint indexed id, bool isSuccessful);
    event FundsWithdrawn(uint indexed id, address indexed account, uint amount);
    event NFTMinted(
        uint indexed projectId,
        address indexed recipient,
        uint indexed tokenId,
        uint rank,
        uint donationAmount
    );

    /*//////////////////////////////////////////////////////////////
                            CORE FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function createProject(
        string memory _name,
        string memory _description,
        uint _goal,
        uint _deadline
    ) external;

    function donate(uint _projectId) external payable;

    function completeProject(uint _projectId) external;

    function withdrawFunds(uint _projectId, uint amount) external;

    function refund(uint _projectId) external;

    /*//////////////////////////////////////////////////////////////
                            STATE GETTERS
    //////////////////////////////////////////////////////////////*/
    function projects(
        uint
    )
        external
        view
        returns (
            uint id,
            address payable creator,
            string memory name,
            string memory description,
            uint goal,
            uint deadline,
            uint currentAmount,
            uint totalAmount,
            uint allowence,
            bool completed,
            bool isSuccessful
        );

    function donorAmounts(address, uint) external view returns (uint);

    function getProjectInfo(
        uint _projectId
    )
        external
        view
        returns (
            uint id,
            address payable creator,
            string memory name,
            string memory description,
            uint goal,
            uint deadline,
            uint currentAmount,
            uint totalAmount,
            uint allowence,
            bool completed,
            bool isSuccessful,
            uint remainingTime,
            uint numDonors
        );

    function getProjectCount() external view returns (uint);

    function increaseAllowence(uint _projectId, uint _amount) external;

    function setProjectFailed(uint _projectId) external;
}
