import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("GigabrainPasses", function () {
  async function deployGigabrainPassesFixture() {
    // Deploy mock USDC token first
    const usdcToken = await hre.viem.deployContract("MockERC20", [
      "USD Coin",
      "USDC",
      6,
    ]);

    // Deploy GigabrainPasses with USDC token address
    const gigabrainPasses = await hre.viem.deployContract("GigabrainPasses", [
      usdcToken.address,
    ]);

    // Get wallet clients
    const [owner, user, other] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    return {
      usdcToken,
      gigabrainPasses,
      owner,
      user,
      other,
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

    it("Should set the correct USDC token address", async function () {
      const { gigabrainPasses, usdcToken } = await loadFixture(
        deployGigabrainPassesFixture
      );
      expect(await gigabrainPasses.read.usdcToken()).to.equal(
        getAddress(usdcToken.address)
      );
    });
  });

  describe("Minting", function () {
    it("Should mint pass when user has sufficient USDC tokens and allowance", async function () {
      const { gigabrainPasses, usdcToken, user } = await loadFixture(
        deployGigabrainPassesFixture
      );
      // Mint USDC tokens to user (5 USDC)
      await usdcToken.write.mint([
        user.account.address,
        5_000_000n,
      ]);
      // Approve spending
      const usdcTokenAsUser = await hre.viem.getContractAt(
        "MockERC20",
        usdcToken.address,
        { client: { wallet: user } }
      );
      await usdcTokenAsUser.write.approve([
        gigabrainPasses.address,
        5_000_000n,
      ]);
      const gigabrainPassesAsUser = await hre.viem.getContractAt(
        "GigabrainPasses",
        gigabrainPasses.address,
        { client: { wallet: user } }
      );
      await expect(
        gigabrainPassesAsUser.write.mintPass([
          user.account.address,
        ])
      ).to.be.fulfilled;
      // Verify NFT was minted
      expect(
        await gigabrainPasses.read.balanceOf([user.account.address])
      ).to.equal(1n);
      // Verify pass expiry was set
      const tokenId = 1n;
      const passExpiry = await gigabrainPasses.read.passExpiry([tokenId]);
      expect(Number(passExpiry)).to.be.greaterThan(0);
      // Verify pass is valid
      expect(await gigabrainPasses.read.isPassValid([tokenId])).to.be.true;
      // Verify totalSupply
      expect(await gigabrainPasses.read.totalSupply()).to.equal(1n);
    });

    it("Should fail to mint when max supply is reached", async function () {
      const { gigabrainPasses, usdcToken, user, other } = await loadFixture(
        deployGigabrainPassesFixture
      );
      // Mint and approve for 42 users
      for (let i = 0; i < 42; i++) {
        await usdcToken.write.mint([
          user.account.address,
          5_000_000n,
        ]);
        const usdcTokenAsUser = await hre.viem.getContractAt(
          "MockERC20",
          usdcToken.address,
          { client: { wallet: user } }
        );
        await usdcTokenAsUser.write.approve([
          gigabrainPasses.address,
          5_000_000n,
        ]);
        const gigabrainPassesAsUser = await hre.viem.getContractAt(
          "GigabrainPasses",
          gigabrainPasses.address,
          { client: { wallet: user } }
        );
        await gigabrainPassesAsUser.write.mintPass([
          user.account.address,
        ]);
      }
      // Now, 43rd mint should fail
      await usdcToken.write.mint([
        other.account.address,
        5_000_000n,
      ]);
      const usdcTokenAsOther = await hre.viem.getContractAt(
        "MockERC20",
        usdcToken.address,
        { client: { wallet: other } }
      );
      await usdcTokenAsOther.write.approve([
        gigabrainPasses.address,
        5_000_000n,
      ]);
      const gigabrainPassesAsOther = await hre.viem.getContractAt(
        "GigabrainPasses",
        gigabrainPasses.address,
        { client: { wallet: other } }
      );
      await expect(
        gigabrainPassesAsOther.write.mintPass([
          other.account.address,
        ])
      ).to.be.rejectedWith("All passes minted");
    });

    it("Should fail to mint with insufficient allowance", async function () {
      const { gigabrainPasses, usdcToken, user } = await loadFixture(
        deployGigabrainPassesFixture
      );
      // Mint USDC tokens to user
      await usdcToken.write.mint([
        user.account.address,
        5_000_000n,
      ]);
      // Approve less than PASS_COST
      const usdcTokenAsUser = await hre.viem.getContractAt(
        "MockERC20",
        usdcToken.address,
        { client: { wallet: user } }
      );
      await usdcTokenAsUser.write.approve([
        gigabrainPasses.address,
        1_000_000n,
      ]);
      const gigabrainPassesAsUser = await hre.viem.getContractAt(
        "GigabrainPasses",
        gigabrainPasses.address,
        { client: { wallet: user } }
      );
      await expect(
        gigabrainPassesAsUser.write.mintPass([
          user.account.address,
        ])
      ).to.be.rejectedWith("Insufficient USDC allowance");
    });
  });

  describe("Pass Validity and User Activity", function () {
    it("Should correctly report pass validity and user activity", async function () {
      const { gigabrainPasses, usdcToken, user } = await loadFixture(
        deployGigabrainPassesFixture
      );
      // Mint USDC tokens and approve
      await usdcToken.write.mint([
        user.account.address,
        5_000_000n,
      ]);
      const usdcTokenAsUser = await hre.viem.getContractAt(
        "MockERC20",
        usdcToken.address,
        { client: { wallet: user } }
      );
      await usdcTokenAsUser.write.approve([
        gigabrainPasses.address,
        5_000_000n,
      ]);
      const gigabrainPassesAsUser = await hre.viem.getContractAt(
        "GigabrainPasses",
        gigabrainPasses.address,
        { client: { wallet: user } }
      );
      await gigabrainPassesAsUser.write.mintPass([
        user.account.address,
      ]);
      const tokenId = 1n;
      expect(await gigabrainPasses.read.isPassValid([tokenId])).to.be.true;
      expect(await gigabrainPasses.read.isUserActive([user.account.address])).to.be.true;
    });
  });

  describe("Token URI and Base URI", function () {
    it("Should allow owner to set base URI", async function () {
      const { gigabrainPasses, owner } = await loadFixture(
        deployGigabrainPassesFixture
      );
      await gigabrainPasses.write.setBaseURI(["https://example.com/metadata/"]);
      // We can't directly call _baseURI (internal), but can check indirectly
      // by minting and checking tokenURI if implemented, or check base URI via storage if public
    });
  });

  describe("Withdraw USDC", function () {
    it("Should allow owner to withdraw USDC", async function () {
      const { gigabrainPasses, usdcToken, owner, user } = await loadFixture(
        deployGigabrainPassesFixture
      );
      // Mint and approve
      await usdcToken.write.mint([
        user.account.address,
        5_000_000n,
      ]);
      const usdcTokenAsUser = await hre.viem.getContractAt(
        "MockERC20",
        usdcToken.address,
        { client: { wallet: user } }
      );
      await usdcTokenAsUser.write.approve([
        gigabrainPasses.address,
        5_000_000n,
      ]);
      const gigabrainPassesAsUser = await hre.viem.getContractAt(
        "GigabrainPasses",
        gigabrainPasses.address,
        { client: { wallet: user } }
      );
      await gigabrainPassesAsUser.write.mintPass([
        user.account.address,
      ]);
      // Withdraw as owner
      const before = await usdcToken.read.balanceOf([owner.account.address]);
      await gigabrainPasses.write.withdrawUSDC([owner.account.address]);
      const after = await usdcToken.read.balanceOf([owner.account.address]);
      expect(after - before).to.equal(4_990_000n); // 4.99 USDC
    });
  });
});
