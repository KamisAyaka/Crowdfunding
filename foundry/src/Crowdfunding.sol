// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/ICrowdfundingNFT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Crowdfunding is Ownable {
    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/
    // 项目结构体，存储项目的基本信息
    struct Project {
        uint id; // 项目唯一标识
        address payable creator; // 项目发起人地址
        string name; // 项目名称
        string description; // 项目描述
        uint goal; // 筹款目标金额
        uint deadline; // 截止日期（时间戳）
        uint currentAmount; // 当前剩余筹款总额
        uint totalAmount; // 项目总筹款金额
        uint allowence; //提案者允许使用的金额
        bool completed; // 项目是否已结束
        bool isSuccessful; // 项目是否成功
    }
    // 项目创建事件
    event ProjectCreated(
        uint indexed id,
        address indexed creator,
        string name,
        string description,
        uint goal,
        uint deadline
    );

    // 资金捐赠事件
    event DonationMade(
        uint indexed id,
        address indexed donor,
        uint amount,
        uint currentAmount
    );

    // 项目完成事件
    event ProjectCompleted(uint indexed id, bool isSuccessful);

    // 提取资金事件
    event FundsWithdrawn(uint indexed id, address indexed account, uint amount);

    // 铸造NFT事件
    event NFTMinted(
        uint indexed id,
        address indexed recipient,
        uint indexed tokenId,
        uint rank,
        uint donationAmount
    );
    // 提案者增加金额事件
    event AllowenceIncreased(uint indexed id, uint allowence);

    event ProjectFailed(uint indexed id);

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    // 存储所有项目
    Project[] public projects;

    // 记录用户对特定项目的捐赠金额
    mapping(address => mapping(uint => uint)) public donorAmounts;

    // 记录项目ID到其对应捐赠者的映射
    mapping(uint => address[]) public projectDonors;

    // NFT合约地址
    address public nftContractAddress;

    // 提案者地址
    address public proposalAddress;

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/
    // Modifier - 检查项目是否存在
    modifier projectExists(uint _projectId) {
        require(_projectId < projects.length, "Project does not exist");
        _;
    }

    // Modifier - 检查项目未完成
    modifier projectNotCompleted(uint _projectId) {
        require(
            !projects[_projectId].completed,
            "Project has already completed"
        );
        _;
    }

    // Modifier - 检查项目已完成
    modifier projectCompleted(uint _projectId) {
        require(projects[_projectId].completed, "Project has not completed");
        _;
    }

    // Modifier - 检查已经到达截止日期
    modifier deadlineReached(uint _projectId) {
        require(
            block.timestamp >= projects[_projectId].deadline,
            "Deadline has not expired"
        );
        _;
    }

    // Modifier - 检查调用者是项目发起人
    modifier onlyCreator(uint _projectId) {
        require(
            msg.sender == projects[_projectId].creator,
            "Only the creator can perform this action"
        );
        _;
    }

    // Modifier - 检查捐赠者有余额可以退款
    modifier donorHasBalance(uint _projectId) {
        require(
            donorAmounts[msg.sender][_projectId] > 0,
            "No balance to refund"
        );
        _;
    }

    /*//////////////////////////////////////////////////////////////
                             MAIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    constructor() Ownable(msg.sender) {}

    function setNFTContractAddress(address _nftAddress) external onlyOwner {
        require(_nftAddress != address(0), "Invalid address");
        nftContractAddress = _nftAddress;
    }

    function setProposalAddress(address _proposalAddress) external onlyOwner {
        require(_proposalAddress != address(0), "Invalid address");
        proposalAddress = _proposalAddress;
    }

    // 创建新项目
    // 参数：项目名称、项目描述、筹款目标金额、截止日期
    // 返回：无
    // 任何人都可以调用此函数
    function createProject(
        string memory _name,
        string memory _description,
        uint _goal,
        uint _deadline
    ) public {
        // 检查目标金额是否为0
        require(_goal > 0, "Goal must be greater than 0");
        // 检查截止日期是否为将来的时间
        require(_deadline > block.timestamp, "Deadline must be in the future");

        // 创建新项目
        Project memory newProject = Project({
            id: projects.length,
            creator: payable(msg.sender),
            name: _name,
            description: _description,
            goal: _goal,
            deadline: _deadline,
            currentAmount: 0,
            totalAmount: 0,
            allowence: 0,
            completed: false,
            isSuccessful: false
        });

        // 添加项目到项目数组
        projects.push(newProject);

        // 触发项目创建事件
        emit ProjectCreated(
            newProject.id,
            newProject.creator,
            newProject.name,
            newProject.description,
            newProject.goal,
            newProject.deadline
        );
    }

    // 向项目捐赠资金
    // 参数：项目ID
    // 任何人都可以向某个项目捐赠资金
    function donate(
        uint _projectId
    ) public payable projectExists(_projectId) projectNotCompleted(_projectId) {
        // 检查捐赠金额是否大于0
        require(msg.value > 0, "Donation amount must be greater than 0");
        // 检查当前时间是否小于项目的截止时间
        require(
            block.timestamp < projects[_projectId].deadline,
            "Project has passed its deadline"
        );

        // 获取项目
        Project storage project = projects[_projectId];

        // 更新项目当前筹款金额
        project.currentAmount += msg.value;

        // 记录捐赠者
        if (donorAmounts[msg.sender][_projectId] == 0) {
            projectDonors[_projectId].push(msg.sender);
        }

        // 更新捐赠者金额
        donorAmounts[msg.sender][_projectId] += msg.value;

        // 触发捐赠事件
        emit DonationMade(
            _projectId,
            msg.sender,
            donorAmounts[msg.sender][_projectId],
            project.currentAmount
        );
    }

    // 结束项目
    // 参数：项目ID、收款人列表、收款金额列表
    // 只有项目发起人在项目成功的时候才可以调用此函数，因为项目发起人需要在项目成功后给参与者铸造nft作为感谢
    // 这是需要花费gas的，所以需要项目创始人确认
    // 如果项目失败了，任何人都可以调用该函数结束项目赎回资金，防止项目创始人恶意不结束项目导致用户资金被锁
    function completeProject(
        uint _projectId,
        address[] memory _recipients,
        uint[] memory _amounts
    )
        public
        projectExists(_projectId)
        projectNotCompleted(_projectId)
        deadlineReached(_projectId)
    {
        // 获取项目
        Project storage project = projects[_projectId];

        if (project.currentAmount >= project.goal) {
            require(
                msg.sender == project.creator,
                "Only creator can complete successful projects"
            );
        }

        // 标记项目为已完成
        project.completed = true;
        project.totalAmount = project.currentAmount;

        // 判断项目是否成功
        if (project.currentAmount >= project.goal) {
            project.isSuccessful = true;

            // 铸造NFT给项目贡献者
            _mintNFTsForDonors(_projectId, _recipients, _amounts);

            // 释放启动资金给项目发起人
            project.allowence = (project.totalAmount * 25) / 100;
            // 触发项目完成事件（成功）
            emit ProjectCompleted(_projectId, true);
        } else {
            project.isSuccessful = false;
            // 触发项目完成事件（失败）
            emit ProjectCompleted(_projectId, false);
        }
    }

    // 提取项目资金（仅限项目发起人）
    // 参数：项目ID、提取金额
    // 只有项目发起人可以调用此函数，且提取的金额不能超过allowence的上限
    // 想要提取更多金额只能发起提案通过后增加allowence的值
    function withdrawFunds(
        uint _projectId,
        uint amount
    )
        public
        projectExists(_projectId)
        projectCompleted(_projectId)
        onlyCreator(_projectId)
    {
        // 获取项目
        Project storage project = projects[_projectId];
        // 检查项目是否成功
        require(project.isSuccessful, "Project was not successful");
        // 检查资金
        require(
            project.totalAmount - project.currentAmount + amount <=
                project.allowence,
            "No enough Allowence funds to withdraw"
        );

        // 更新项目剩余的金额
        project.currentAmount -= amount;

        // 转账给项目发起人
        (bool success, ) = project.creator.call{value: amount}("");
        require(success, "Failed to transfer funds to project creator");

        // 触发提取资金事件
        emit FundsWithdrawn(_projectId, project.creator, amount);
    }

    // 退款（仅限未成功的项目）
    // 参数：项目ID
    // 只有项目失败时，捐赠者才可以调用此函数，如果项目成功，捐赠者无法调用此函数
    // 会直接将捐赠者捐助的钱按剩余的钱比例退回
    function refund(
        uint _projectId
    )
        public
        projectExists(_projectId)
        projectCompleted(_projectId)
        donorHasBalance(_projectId)
    {
        // 获取项目
        Project storage project = projects[_projectId];
        // 检查项目是否失败
        require(!project.isSuccessful, "Project was successful, cannot refund");

        // 获取退款金额
        uint amount = ((donorAmounts[msg.sender][_projectId] *
            project.currentAmount) / project.totalAmount);
        // 更新捐赠者余额为0
        donorAmounts[msg.sender][_projectId] = 0;

        // 转账给捐赠者
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Failed to refund donor");

        // 触发提取资金事件
        emit FundsWithdrawn(_projectId, msg.sender, amount);
    }

    /*//////////////////////////////////////////////////////////////
                                EXTERNAL
    //////////////////////////////////////////////////////////////*/
    // 增加allowence，只有提案合约的地址才能调用此函数
    function increaseAllowence(uint _projectId, uint _amount) external {
        require(msg.sender == proposalAddress, "Unauthorized");
        projects[_projectId].allowence += _amount;
        emit AllowenceIncreased(_projectId, projects[_projectId].allowence);
    }

    // 设置项目失败，只有提案合约才能调用，在提案连续失败三次之后设置该项目为失败
    function setProjectFailed(uint _projectId) external {
        require(msg.sender == proposalAddress, "Unauthorized");
        Project storage project = projects[_projectId];
        project.allowence = 0;
        project.isSuccessful = false; // 强制标记项目为失败状态
        emit ProjectFailed(_projectId);
    }

    /*//////////////////////////////////////////////////////////////
                                INTERNAL
    //////////////////////////////////////////////////////////////*/

    // 铸造NFT给捐赠者
    // 参数：项目ID、捐赠者地址、捐赠金额
    // 捐赠者地址和捐赠金额数组长度必须一致
    // 项目创始人应在调用完成项目的函数时传入捐赠者地址和捐赠金额数组
    // 捐赠者地址必须要在捐赠记录的名单中，
    function _mintNFTsForDonors(
        uint _projectId,
        address[] memory donors,
        uint[] memory amounts
    ) internal {
        require(donors.length == amounts.length, "Invalid input");
        for (uint i = 0; i < donors.length; i++) {
            // 验证地址是否存在于捐赠记录中
            require(
                donorAmounts[donors[i]][_projectId] > 0,
                "Address is not a donor"
            );

            // 铸造NFT
            uint tokenId = ICrowdfundingNFT(nftContractAddress).mintNFT(
                donors[i],
                _projectId,
                i + 1, // 排名从1开始
                amounts[i]
            );

            // 触发NFT铸造事件
            emit NFTMinted(_projectId, donors[i], tokenId, i + 1, amounts[i]);
        }
    }

    /*//////////////////////////////////////////////////////////////
                            GETTER FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function getProjectDonors(
        uint _projectId
    ) public view returns (address[] memory) {
        return projectDonors[_projectId];
    }

    // 获取项目总数
    function getProjectCount() public view returns (uint) {
        return projects.length;
    }

    function getNftContractAddress() public view returns (address) {
        return nftContractAddress;
    }

    // 获取项目信息
    function getProjectInfo(
        uint _projectId
    )
        public
        view
        projectExists(_projectId)
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
        )
    {
        Project storage project = projects[_projectId];

        id = project.id;
        creator = project.creator;
        name = project.name;
        description = project.description;
        goal = project.goal;
        deadline = project.deadline;
        currentAmount = project.currentAmount;
        totalAmount = project.totalAmount;
        allowence = project.allowence;
        completed = project.completed;
        isSuccessful = project.isSuccessful;
    }
}
