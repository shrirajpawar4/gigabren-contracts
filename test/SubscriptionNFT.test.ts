import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

describe("GigabrainPasses", function () {
  async function deployGigabrainPassesFixture() {
    // Deploy mock ERC20 token first
    const mockToken = await hre.viem.deployContract("MockERC20", [
      "USD Coin",
      "USDC",
      6, // 6 decimals like USDC
    ]);

    // Deploy GigabrainPasses with mock token address
    const gigabrainPasses = await hre.viem.deployContract("GigabrainPasses", [
      mockToken.address,
    ]);

    // Get wallet clients
    const [owner, user1, user2] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    return {
      mockToken,
      gigabrainPasses,
      owner,
      user1,
      user2,
      publicClient,
    };
  }

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const { gigabrainPasses, owner } = await loadFixture(
        deployGigabrainPassesFixture
      );
      expect(await gigabrainPasses.read.owner()).to.equal(
        getAddress(owner.account.address)
      );
    });

    it("Should set the correct token address", async function () {
      const { gigabrainPasses, mockToken } = await loadFixture(
        deployGigabrainPassesFixture
      );
      expect(await gigabrainPasses.read.usdcToken()).to.equal(
        getAddress(mockToken.address)
      );
    });

    it("Should set the correct initial values", async function () {
      const { gigabrainPasses } = await loadFixture(deployGigabrainPassesFixture);
      expect(await gigabrainPasses.read.passCost()).to.equal(4_990_000n);
      expect(await gigabrainPasses.read.passDuration()).to.equal(2_592_000n); // 30 days in seconds
      expect(await gigabrainPasses.read.maxSupply()).to.equal(42n);
    });
  });

  describe("Minting", function () {
    it("Should mint pass when user has sufficient tokens and allowance", async function () {
      const { gigabrainPasses, mockToken, user1 } = await loadFixture(
        deployGigabrainPassesFixture
      );

      // Mint tokens to user
      await mockToken.write.mint([
        user1.account.address,
        10_000_000n, // 10 USDC
      ]);

      // Approve spending
      const mockTokenAsUser = await hre.viem.getContractAt(
        "MockERC20",
        mockToken.address,
        { client: { wallet: user1 } }
      );
      await mockTokenAsUser.write.approve([
        gigabrainPasses.address,
        5_000_000n,
      ]);

      // Mint pass
      const gigabrainPassesAsUser = await hre.viem.getContractAt(
        "GigabrainPasses",
        gigabrainPasses.address,
        { client: { wallet: user1 } }
      );
      await gigabrainPassesAsUser.write.mintPass([user1.account.address]);

      // Verify NFT was minted
      expect(await gigabrainPasses.read.balanceOf([user1.account.address])).to.equal(1n);
      expect(await gigabrainPasses.read.totalSupply()).to.equal(1n);
    });

    it("Should fail to mint when max supply is reached", async function () {
      const { gigabrainPasses, mockToken, user1, user2 } = await loadFixture(
        deployGigabrainPassesFixture
      );

      // Set max supply to 1
      await gigabrainPasses.write.setMaxSupply([1n]);

      // First mint should succeed
      await mockToken.write.mint([user1.account.address, 10_000_000n]);
      const mockTokenAsUser1 = await hre.viem.getContractAt(
        "MockERC20",
        mockToken.address,
        { client: { wallet: user1 } }
      );
      await mockTokenAsUser1.write.approve([gigabrainPasses.address, 5_000_000n]);
      const gigabrainPassesAsUser1 = await hre.viem.getContractAt(
        "GigabrainPasses",
        gigabrainPasses.address,
        { client: { wallet: user1 } }
      );
      await gigabrainPassesAsUser1.write.mintPass([user1.account.address]);

      // Second mint should fail
      await mockToken.write.mint([user2.account.address, 10_000_000n]);
      const mockTokenAsUser2 = await hre.viem.getContractAt(
        "MockERC20",
        mockToken.address,
        { client: { wallet: user2 } }
      );
      await mockTokenAsUser2.write.approve([gigabrainPasses.address, 5_000_000n]);
      const gigabrainPassesAsUser2 = await hre.viem.getContractAt(
        "GigabrainPasses",
        gigabrainPasses.address,
        { client: { wallet: user2 } }
      );
      await expect(
        gigabrainPassesAsUser2.write.mintPass([user2.account.address])
      ).to.be.rejectedWith("All passes minted");
    });

    it("Should fail to mint with insufficient allowance", async function () {
      const { gigabrainPasses, mockToken, user1 } = await loadFixture(
        deployGigabrainPassesFixture
      );

      await mockToken.write.mint([user1.account.address, 10_000_000n]);
      const mockTokenAsUser = await hre.viem.getContractAt(
        "MockERC20",
        mockToken.address,
        { client: { wallet: user1 } }
      );
      await mockTokenAsUser.write.approve([gigabrainPasses.address, 1_000_000n]);

      const gigabrainPassesAsUser = await hre.viem.getContractAt(
        "GigabrainPasses",
        gigabrainPasses.address,
        { client: { wallet: user1 } }
      );
      await expect(
        gigabrainPassesAsUser.write.mintPass([user1.account.address])
      ).to.be.rejectedWith("Insufficient USDC allowance");
    });

    it("Should allow admin to mint for free", async function () {
      const { gigabrainPasses, user1 } = await loadFixture(
        deployGigabrainPassesFixture
      );

      await gigabrainPasses.write.adminMint([user1.account.address]);
      expect(await gigabrainPasses.read.balanceOf([user1.account.address])).to.equal(1n);
    });

    it("Should fail when non-admin tries to admin mint", async function () {
      const { gigabrainPasses, user1 } = await loadFixture(
        deployGigabrainPassesFixture
      );

      const gigabrainPassesAsUser = await hre.viem.getContractAt(
        "GigabrainPasses",
        gigabrainPasses.address,
        { client: { wallet: user1 } }
      );
      await expect(
        gigabrainPassesAsUser.write.adminMint([user1.account.address])
      ).to.be.rejectedWith("OwnableUnauthorizedAccount");
    });
  });

  describe("Pass Validity", function () {
    it("Should correctly report pass validity", async function () {
      const { gigabrainPasses, mockToken, user1 } = await loadFixture(
        deployGigabrainPassesFixture
      );

      await mockToken.write.mint([user1.account.address, 10_000_000n]);
      const mockTokenAsUser = await hre.viem.getContractAt(
        "MockERC20",
        mockToken.address,
        { client: { wallet: user1 } }
      );
      await mockTokenAsUser.write.approve([gigabrainPasses.address, 5_000_000n]);
      const gigabrainPassesAsUser = await hre.viem.getContractAt(
        "GigabrainPasses",
        gigabrainPasses.address,
        { client: { wallet: user1 } }
      );
      await gigabrainPassesAsUser.write.mintPass([user1.account.address]);

      expect(await gigabrainPasses.read.isPassValid([1n])).to.be.true;
    });

    it("Should correctly report user activity", async function () {
      const { gigabrainPasses, mockToken, user1, user2 } = await loadFixture(
        deployGigabrainPassesFixture
      );

      await mockToken.write.mint([user1.account.address, 10_000_000n]);
      const mockTokenAsUser = await hre.viem.getContractAt(
        "MockERC20",
        mockToken.address,
        { client: { wallet: user1 } }
      );
      await mockTokenAsUser.write.approve([gigabrainPasses.address, 5_000_000n]);
      const gigabrainPassesAsUser = await hre.viem.getContractAt(
        "GigabrainPasses",
        gigabrainPasses.address,
        { client: { wallet: user1 } }
      );
      await gigabrainPassesAsUser.write.mintPass([user1.account.address]);

      expect(await gigabrainPasses.read.isUserActive([user1.account.address])).to.be.true;
      expect(await gigabrainPasses.read.isUserActive([user2.account.address])).to.be.false;
    });
  });

  describe("Owner Controls", function () {
    it("Should allow owner to update max supply", async function () {
      const { gigabrainPasses } = await loadFixture(deployGigabrainPassesFixture);
      await gigabrainPasses.write.setMaxSupply([100n]);
      expect(await gigabrainPasses.read.maxSupply()).to.equal(100n);
    });

    it("Should fail when non-owner tries to update max supply", async function () {
      const { gigabrainPasses, user1 } = await loadFixture(
        deployGigabrainPassesFixture
      );

      const gigabrainPassesAsUser = await hre.viem.getContractAt(
        "GigabrainPasses",
        gigabrainPasses.address,
        { client: { wallet: user1 } }
      );
      await expect(
        gigabrainPassesAsUser.write.setMaxSupply([100n])
      ).to.be.rejectedWith("OwnableUnauthorizedAccount");
    });

    it("Should allow owner to update pass cost", async function () {
      const { gigabrainPasses } = await loadFixture(deployGigabrainPassesFixture);
      await gigabrainPasses.write.setPassCost([9_990_000n]);
      expect(await gigabrainPasses.read.passCost()).to.equal(9_990_000n);
    });

    it("Should allow owner to update pass duration", async function () {
      const { gigabrainPasses } = await loadFixture(deployGigabrainPassesFixture);
      const newDuration = 5_184_000n; // 60 days
      await gigabrainPasses.write.setPassDuration([newDuration]);
      expect(await gigabrainPasses.read.passDuration()).to.equal(newDuration);
    });

    it("Should allow owner to withdraw tokens", async function () {
      const { gigabrainPasses, mockToken, owner, user1 } = await loadFixture(
        deployGigabrainPassesFixture
      );

      // Mint a pass first
      await mockToken.write.mint([user1.account.address, 10_000_000n]);
      const mockTokenAsUser = await hre.viem.getContractAt(
        "MockERC20",
        mockToken.address,
        { client: { wallet: user1 } }
      );
      await mockTokenAsUser.write.approve([gigabrainPasses.address, 5_000_000n]);
      const gigabrainPassesAsUser = await hre.viem.getContractAt(
        "GigabrainPasses",
        gigabrainPasses.address,
        { client: { wallet: user1 } }
      );
      await gigabrainPassesAsUser.write.mintPass([user1.account.address]);

      // Withdraw as owner
      const before = await mockToken.read.balanceOf([owner.account.address]);
      await gigabrainPasses.write.withdrawUSDC([owner.account.address]);
      const after = await mockToken.read.balanceOf([owner.account.address]);
      expect(after - before).to.equal(4_990_000n); // 4.99 USDC
    });
  });

  describe("Token URI", function () {
    it("Should allow owner to set base URI", async function () {
      const { gigabrainPasses } = await loadFixture(deployGigabrainPassesFixture);
      const baseURI = "https://example.com/metadata/";
      await gigabrainPasses.write.setBaseURI([baseURI]);
      // We can't directly call _baseURI (internal), but can check indirectly
      // by minting and checking tokenURI if implemented, or check base URI via storage if public
    });
  });
});
