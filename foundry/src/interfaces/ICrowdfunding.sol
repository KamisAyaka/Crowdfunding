// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICrowdfunding {
    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/
    struct Project {
        uint id;
        address payable creator;
        string name;
        string description;
        uint goal;
        uint deadline;
        uint currentAmount;
        bool completed;
        bool isSuccessful;
    }

    /*//////////////////////////////////////////////////////////////
                             MAIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function donate(uint _projectId) external payable;

    function completeProject(uint _projectId) external;

    function withdrawFunds(uint _projectId) external;

    function refund(uint _projectId) external;

    function setNFTContractAddress(address _nftAddress) external;

    function createProject(
        string memory _name,
        string memory _description,
        uint _goal,
        uint _deadline
    ) external;

    /*//////////////////////////////////////////////////////////////
                                GETTERS
    //////////////////////////////////////////////////////////////*/
    function projects(
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
            bool completed,
            bool isSuccessful
        );

    function donorAmounts(
        address _donor,
        uint _projectId
    ) external view returns (uint);

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
            bool completed,
            bool isSuccessful,
            uint remainingTime,
            uint numDonors
        );

    function updateCurrentAmount(uint _projectId, uint _amount) external;

    function updateDonorBalance(
        uint _projectId,
        address _donor,
        uint _newBalance
    ) external;
}
