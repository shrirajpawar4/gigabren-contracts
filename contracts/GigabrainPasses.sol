// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GigabrainPass is ERC721, Ownable {
    IERC20 public usdcToken;
    uint256 private _tokenIds;
    string private _baseTokenURI;

    uint256 public passCost; // Editable pass cost
    uint256 public passDuration; // Editable pass validity duration
    uint256 public maxSupply; // Editable supply cap

    mapping(uint256 => uint256) public passExpiry; // tokenId => expiryTime
    mapping(address => uint256[]) private userTokenIds; // user => tokenIds

    event PassMinted(address indexed user, uint256 tokenId, uint256 expiryTime);
    event MaxSupplyUpdated(uint256 newMaxSupply);
    event PassCostUpdated(uint256 newPassCost);
    event PassDurationUpdated(uint256 newDuration);

    constructor(
        address _usdcToken,
        address _governance
    ) ERC721("Gigabrain Pass", "GBP") Ownable(_governance) {
        usdcToken = IERC20(_usdcToken);
        passCost = 1_000_000;
        passDuration = 30 days;
        maxSupply = 42;
    }

    // Regular paid mint
    function mintPass(address recipient) external {
        require(totalSupply() < maxSupply, "All passes minted");
        require(
            usdcToken.allowance(msg.sender, address(this)) >= passCost,
            "Insufficient USDC allowance"
        );

        uint256 tokenId = ++_tokenIds;

        require(
            usdcToken.transferFrom(msg.sender, address(this), passCost),
            "USDC transfer failed"
        );

        _safeMint(recipient, tokenId);

        passExpiry[tokenId] = block.timestamp + passDuration;
        userTokenIds[recipient].push(tokenId);

        emit PassMinted(recipient, tokenId, passExpiry[tokenId]);
    }

    // Admin-only free mint
    function adminMint(address recipient) external onlyOwner {
        require(totalSupply() < maxSupply, "All passes minted");

        uint256 tokenId = ++_tokenIds;

        _safeMint(recipient, tokenId);

        passExpiry[tokenId] = block.timestamp + passDuration;
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

    function getUserTokenIds(
        address user
    ) external view returns (uint256[] memory) {
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

    // --------- OWNER CONTROL FUNCTIONS ---------
    // These functions are only callable by the owner to update cost and duration and max supply.
    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        require(
            newMaxSupply >= totalSupply(),
            "Cannot set maxSupply below minted passes"
        );
        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(newMaxSupply);
    }

    function setPassCost(uint256 newPassCost) external onlyOwner {
        require(newPassCost > 0, "Pass cost must be positive");
        passCost = newPassCost;
        emit PassCostUpdated(newPassCost);
    }

    function setPassDuration(uint256 newDuration) external onlyOwner {
        require(newDuration > 0, "Duration must be positive");
        passDuration = newDuration;
        emit PassDurationUpdated(newDuration);
    }
}
