// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GigabrainPasses is ERC721, Ownable {
    IERC20 public usdcToken;
    uint256 private _tokenIds;
    string private _baseTokenURI;

    uint256 public constant PASS_COST = 4990000; // 4.99 USDC with 6 decimals
    uint256 public constant PASS_DURATION = 30 days;
    uint256 public constant MAX_SUPPLY = 42;

    mapping(uint256 => uint256) public passExpiry; // tokenId => expiryTime
    mapping(address => uint256[]) private userTokenIds; // user => tokenIds

    event PassMinted(address indexed user, uint256 tokenId, uint256 expiryTime);

    constructor(address _usdcToken) ERC721("Gigabrain Pass", "GBP") Ownable(msg.sender) {
        usdcToken = IERC20(_usdcToken);
    }

    function mintPass(address recipient) external {
        require(totalSupply() < MAX_SUPPLY, "All passes minted");
        require(usdcToken.allowance(msg.sender, address(this)) >= PASS_COST, "Insufficient USDC allowance");

        uint256 tokenId = ++_tokenIds;

        require(usdcToken.transferFrom(msg.sender, address(this), PASS_COST), "USDC transfer failed");

        _safeMint(recipient, tokenId);

        passExpiry[tokenId] = block.timestamp + PASS_DURATION;
        userTokenIds[recipient].push(tokenId);

        emit PassMinted(recipient, tokenId, passExpiry[tokenId]);
    }

    function totalSupply() public view returns (uint256) {
        return _tokenIds;
    }

    function isPassValid(uint256 tokenId) public view returns (bool) {
        return passExpiry[tokenId] > block.timestamp;
    }

    function isUserActive(address user) public view returns (bool) {
        uint256[] memory tokens = userTokenIds[user];
        for (uint256 i = 0; i < tokens.length; i++) {
            if (isPassValid(tokens[i])) {
                return true;
            }
        }
        return false;
    }

    function getUserTokenIds(address user) external view returns (uint256[] memory) {
        return userTokenIds[user];
    }

    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function withdrawUSDC(address to) external onlyOwner {
        uint256 balance = usdcToken.balanceOf(address(this));
        require(balance > 0, "No USDC to withdraw");
        require(usdcToken.transfer(to, balance), "USDC transfer failed");
    }
}
