// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract CrowdfundingNFT is ERC721, Ownable {
    error ERC721Metadata__URI_QueryFor_NonExistentToken();

    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/
    struct DonationInfo {
        address donor;
        uint256 projectId;
        uint256 donationAmount;
        uint256 rank;
    }
    struct CakeColors {
        string plateColor;
        string bottomColor;
        string topColor;
        string frostingColor;
        string candleColor;
        string decorationsColor;
        string icingSwirlsColor;
    }
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    string constant STROKE_TEXT = '" stroke="';
    string constant CAKE_STARTER =
        '<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg"> <ellipse cx="150" cy="230" rx="120" ry="15" fill="';

    // Each section of the cake is missing (no whitespace at the end):
    // #e0e0e0" stroke="#bbbbbb"
    // This is to be filled in when cake is generated

    // Plate
    string constant CAKE_PLATE_NO_COLOR_PART_TWO = '" stroke-width="1.5"/>';

    // Bottom cake layer:
    string constant BOTTOM_CAKE_LAYER_NO_COLOR_PART_ONE =
        '<rect x="60" y="170" width="180" height="60" rx="10" ry="10" fill="';
    string constant BOTTOM_CAKE_LAYER_NO_COLOR_PART_TWO =
        '" stroke-width="1"/>';

    // Top cake layer:
    string constant TOP_CAKE_LAYER_NO_COLOR_PART_ONE =
        '<rect x="85" y="120" width="130" height="50" rx="10" ry="10" fill="';
    string constant TOP_CAKE_LAYER_NO_COLOR_PART_TWO = '" stroke-width="1"/>';

    // Frosting top:
    string constant FROSTING_TOP_NO_COLOR_PART_ONE =
        '<ellipse cx="150" cy="120" rx="65" ry="10" fill="';
    string constant FROSTING_TOP_NO_COLOR_PART_TWO = '" stroke-width="0.5"/>';

    // Candle:
    string constant CANDLE_NO_COLOR_PART_ONE =
        '<rect x="146" y="85" width="8" height="35" fill="';
    string constant CANDLE_NO_COLOR_PART_TWO = '" stroke-width="0.5"/>';

    // Candle Flame
    string constant CANDLE_FLAME =
        '<path d="M150,85 Q150,75 150,85 M146,85 Q150,75 154,85" fill="#ffdd55" stroke="#ffcc00" stroke-width="1"/>';

    // Simple decoration (all will be the same color)
    string constant DECORATION_CIRCLE_NO_COLOR_PART_ONE =
        '<circle cx="115" cy="145" r="5" fill="';
    string constant DECORATION_CIRCLE_NO_COLOR_PART_TWO =
        '"/><circle cx="150" cy="145" r="5" fill="';
    string constant DECORATION_CIRCLE_NO_COLOR_PART_THREE =
        '"/><circle cx="185" cy="145" r="5" fill="';
    string constant DECORATION_CIRCLE_NO_COLOR_PART_FOUR = '"/>';

    // Simple icing swirls:
    string constant ICING_SWIRLS_NO_COLOR_PART_ONE =
        '<path d="M70,170 C90,160 110,180 130,170 C150,160 170,180 190,170 C210,160 230,180 250,170" fill="none" stroke="';
    string constant ICING_SWIRLS_NO_COLOR_PART_TWO =
        '" stroke-width="3" stroke-linecap="round"/>';
    string constant END_SVG = "</svg>";

    uint256 private s_tokenIdCounter;
    mapping(uint => DonationInfo) public nftInfo;
    mapping(uint256 tokenId => string imageUri) private s_tokenIdToImageUri;
    event CreatedNFT(uint256 indexed tokenId);

    /*//////////////////////////////////////////////////////////////
                               FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    constructor() ERC721("CrowdfundingNFT", "CFNFT") Ownable(msg.sender) {}

    // 铸造NFT给指定地址
    // 参数：接收者地址、项目ID、排名、捐赠金额
    // 返回：生成的NFT的ID
    // 只有众筹合约才能调用此函数，在创建合约的时候会把合约的控制权转移给众筹合约，所以只有众筹合约才能调用此函数
    function mintNFT(
        address to,
        uint projectId,
        uint rank,
        uint donationAmount
    ) public onlyOwner returns (uint256) {
        uint256 tokenId = s_tokenIdCounter;

        // Insecure randomness!!
        uint256 nftSeed = uint256(
            keccak256(
                abi.encodePacked(
                    to,
                    tokenId,
                    projectId,
                    rank,
                    donationAmount,
                    block.number,
                    block.timestamp
                )
            )
        );
        string memory nftSvg = createSvgNftFromSeed(nftSeed);
        string memory imageUri = svgToImageURI(nftSvg);

        _safeMint(to, tokenId);

        // 记录NFT信息
        nftInfo[tokenId] = DonationInfo({
            donor: to,
            projectId: projectId,
            donationAmount: donationAmount,
            rank: rank
        });
        s_tokenIdToImageUri[tokenId] = imageUri;
        emit CreatedNFT(tokenId);
        s_tokenIdCounter++;
        return tokenId;
    }

    function _baseURI() internal pure override returns (string memory) {
        return "data:application/json;base64,";
    }

    function svgToImageURI(
        string memory svg
    ) public pure returns (string memory) {
        string memory baseURI = "data:image/svg+xml;base64,";
        string memory svgBase64Encoded = Base64.encode(
            bytes(string(abi.encodePacked(svg)))
        );
        return string(abi.encodePacked(baseURI, svgBase64Encoded));
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        if (ownerOf(tokenId) == address(0)) {
            revert ERC721Metadata__URI_QueryFor_NonExistentToken();
        }

        string memory imageURI = s_tokenIdToImageUri[tokenId];

        return
            string(
                abi.encodePacked(
                    _baseURI(),
                    Base64.encode(
                        bytes(
                            abi.encodePacked(
                                '{"name":"Crowdfunding NFT #',
                                Strings.toString(tokenId),
                                " - Project ",
                                Strings.toString(nftInfo[tokenId].projectId),
                                " (Rank ",
                                Strings.toString(nftInfo[tokenId].rank),
                                ')", ',
                                '"description":"This NFT commemorates a donation of ',
                                Strings.toString(
                                    nftInfo[tokenId].donationAmount
                                ),
                                " wei to project ",
                                Strings.toString(nftInfo[tokenId].projectId),
                                '", ',
                                '"attributes": [',
                                '{"trait_type": "Project ID", "value": ',
                                Strings.toString(nftInfo[tokenId].projectId),
                                "},",
                                '{"trait_type": "Donation Amount", "value": ',
                                Strings.toString(
                                    nftInfo[tokenId].donationAmount
                                ),
                                "},",
                                '{"trait_type": "Rank", "value": ',
                                Strings.toString(nftInfo[tokenId].rank),
                                "}], ",
                                '"image":"',
                                imageURI,
                                '"}'
                            )
                        )
                    )
                )
            );
    }

    function generateColorFromSeed(
        uint256 seed
    ) public pure returns (string memory) {
        bytes16 characters = "0123456789abcdef";
        bytes memory buffer = new bytes(7);

        buffer[0] = "#";

        for (uint256 i = 0; i < 6; i++) {
            uint8 hexDigit = uint8((seed >> (i * 8)) & 0xFF) % 16;
            buffer[i + 1] = bytes1(characters[hexDigit]);
        }

        return string(buffer);
    }

    function createSvgNftFromSeed(
        uint256 cakeSeed
    ) public pure returns (string memory) {
        string memory finalCake = CAKE_STARTER;
        CakeColors memory cakeColors;

        cakeColors.plateColor = generateColorFromSeed(cakeSeed);
        cakeColors.bottomColor = generateColorFromSeed(
            uint256(keccak256(abi.encodePacked(cakeSeed, uint256(1))))
        );
        cakeColors.topColor = generateColorFromSeed(
            uint256(keccak256(abi.encodePacked(cakeSeed, uint256(2))))
        );
        cakeColors.frostingColor = generateColorFromSeed(
            uint256(keccak256(abi.encodePacked(cakeSeed, uint256(3))))
        );
        cakeColors.candleColor = generateColorFromSeed(
            uint256(keccak256(abi.encodePacked(cakeSeed, uint256(4))))
        );
        cakeColors.decorationsColor = generateColorFromSeed(
            uint256(keccak256(abi.encodePacked(cakeSeed, uint256(5))))
        );
        cakeColors.icingSwirlsColor = generateColorFromSeed(
            uint256(keccak256(abi.encodePacked(cakeSeed, uint256(6))))
        );

        finalCake = string.concat(
            finalCake,
            cakeColors.plateColor,
            STROKE_TEXT,
            cakeColors.plateColor,
            CAKE_PLATE_NO_COLOR_PART_TWO,
            // Bottom Layer
            BOTTOM_CAKE_LAYER_NO_COLOR_PART_ONE,
            cakeColors.bottomColor,
            STROKE_TEXT,
            cakeColors.bottomColor,
            BOTTOM_CAKE_LAYER_NO_COLOR_PART_TWO,
            // Top layer
            TOP_CAKE_LAYER_NO_COLOR_PART_ONE,
            cakeColors.topColor,
            STROKE_TEXT,
            cakeColors.topColor,
            TOP_CAKE_LAYER_NO_COLOR_PART_TWO,
            // Frosting top
            FROSTING_TOP_NO_COLOR_PART_ONE,
            cakeColors.frostingColor,
            STROKE_TEXT,
            cakeColors.frostingColor,
            FROSTING_TOP_NO_COLOR_PART_TWO,
            // Candle
            CANDLE_NO_COLOR_PART_ONE,
            cakeColors.candleColor,
            STROKE_TEXT,
            cakeColors.candleColor,
            CANDLE_NO_COLOR_PART_TWO,
            // Flame
            CANDLE_FLAME,
            // Simple decorations
            DECORATION_CIRCLE_NO_COLOR_PART_ONE,
            cakeColors.decorationsColor,
            DECORATION_CIRCLE_NO_COLOR_PART_TWO,
            cakeColors.decorationsColor,
            DECORATION_CIRCLE_NO_COLOR_PART_THREE,
            cakeColors.decorationsColor,
            DECORATION_CIRCLE_NO_COLOR_PART_FOUR,
            // Icing
            ICING_SWIRLS_NO_COLOR_PART_ONE,
            cakeColors.icingSwirlsColor,
            ICING_SWIRLS_NO_COLOR_PART_TWO,
            END_SVG
        );
        return finalCake;
    }

    /*//////////////////////////////////////////////////////////////
                                GETTERS
    //////////////////////////////////////////////////////////////*/

    // 获取NFT的详细信息
    function getNFTInfo(
        uint256 tokenId
    )
        public
        view
        returns (
            address donor,
            uint256 projectId,
            uint256 rank,
            uint256 donationAmount
        )
    {
        DonationInfo memory info = nftInfo[tokenId];
        return (info.donor, info.projectId, info.rank, info.donationAmount);
    }

    function getTokenIdCounter() public view returns (uint256) {
        return s_tokenIdCounter;
    }
}
