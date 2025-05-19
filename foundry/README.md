# 去中心化众筹平台

基于Solidity的智能合约系统，集成NFT奖励与链上治理机制

## 项目概述
本系统包含三个核心智能合约，实现以下功能：
- 🎉 **去中心化众筹**：支持项目创建、资金捐赠、成果追踪
- 🎨 **动态NFT奖励**：自动为Top5捐赠者生成可收藏的蛋糕主题NFT
- 🗳️ **链上治理**：提案机制实现资金使用透明化管理
- ⚖️ **双重保障机制**：项目成功后的资金释放与失败后的自动退款

## 核心合约

### 1. Crowdfunding 主合约
#### 主要功能
- `createProject()` 创建新项目（名称/描述/目标/截止日期）
- `donate()` 支持ETH捐赠并更新捐赠排名
- `completeProject()` 项目结束后判断是否达到预期筹款的目标：
  - ✅ 成功：释放25%资金 + 铸造NFT
  - ❌ 失败：启动退款通道
- `withdrawFunds()` 项目方分阶段提取资金（初始可以提取25%作为启动资金，之后还想提取更多的资金需要发起提案进行投票）
- `refund()` 捐赠者赎回资金（项目失败之后可以取回）

#### 数据结构
```solidity
struct Project {
    uint id;                // 项目ID
    address creator;        // 发起人
    string name;            // 项目名称
    uint goal;              // 目标金额(wei)
    uint deadline;          // 截止时间戳
    uint currentAmount;     // 当前剩余资金
    uint totalAmount;       // 总募资金额
    uint allowence;         // 可提取额度
    bool completed;         // 是否完成
    bool isSuccessful;      // 是否成功
}
```

### 2. CrowdfundingNFT 合约
#### NFT特性
- 🖼️ **动态生成SVG**：通过`createSvgNftFromSeed()`生成7层参数的蛋糕图像
- 📝 **元数据包含**：
  - 项目ID
  - 捐赠金额 
  - 捐赠排名（1-5）
- 🔒 **安全铸造**：仅项目合约可调用`mintNFT()`

#### 视觉元素
```solidity
struct CakeColors {
    string plateColor;         // 餐盘颜色
    string bottomColor;        // 底层蛋糕
    string topColor;           // 顶层蛋糕
    string frostingColor;      // 糖霜颜色
    string candleColor;        // 蜡烛颜色
    string decorationsColor;   // 装饰颜色
    string icingSwirlsColor;   // 糖衣旋涡颜色
}
```

### 3. ProposalGovernance 治理合约
#### 提案生命周期
1. **创建提案** `createProposal()`
   - 仅项目发起人
   - 每次只能存在一个活跃提案
   - 投票周期1-7天

2. **投票机制** `voteOnProposal()`
   - ⚖️ 权重与捐赠金额正相关
   - ✅ 支持/❌ 反对票分离统计
   - 🕒 截止时间或过半投票自动结束

3. **提案执行** `executeProposal()`
   - 通过：增加项目可用资金额度
   - 拒绝：累计失败次数，3次失败触发项目终止

## 部署与交互

### 前置条件
- [Foundry](https://getfoundry.sh/) 开发环境
- Solidity 0.8.0+

### 部署步骤
1. 部署NFT合约：
```bash
forge create CrowdfundingNFT --constructor-args "CrowdfundingNFT" "CFNFT"
```

2. 部署主合约：
```bash
forge create Crowdfunding
```

3. 部署治理合约：
```bash
forge create ProposalGovernance --constructor-args <Crowdfunding合约地址>
```

4. 设置合约关联：
```solidity
crowdfunding.setNFTContractAddress(nftAddress);
// 设置NFT合约的owner为众筹合约
nft.transferOwnership(address(crowdfunding));
crowdfunding.setProposalAddress(governanceAddress);
```

## 使用示例

### 创建项目
```javascript
// 参数：名称，描述，目标(wei)，截止时间戳
await crowdfunding.createProject(
    "Web3教育平台", 
    "构建去中心化学习系统", 
    ethers.parseEther("100"), 
    Math.floor(Date.now()/1000) + 86400*7 // 7天后
);
```

### 捐赠参与
```javascript
// 捐赠1 ETH到项目0
await crowdfunding.donate(0, { value: ethers.parseEther("1") });
```

### 创建资金提案
```solidity
// 请求50 ETH资金，投票周期3天
await governance.createProposal(
    0,                      // 项目ID
    ethers.parseEther("50"), 
    3, 
    "开发移动端应用"
);
```

## 安全机制
- 🔐 仅Owner可设置关键合约地址
- ⏳ 提案超时自动失效
- 🛑 三次提案失败自动触发退款
- 💸 资金提取需通过allowence额度控制

## 事件监控
```solidity
// 项目事件
event ProjectCreated(uint id, address creator, string name, uint goal);
event DonationMade(uint projectId, address donor, uint amount);

// NFT事件
event CreatedNFT(uint indexed tokenId);
event NFTMinted(uint projectId, address recipient, uint tokenId);

// 治理事件
event ProposalCreated(uint projectId, uint proposalId, uint amount);
event Voted(uint projectId, uint proposalId, address voter, bool support);
