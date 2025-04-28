import hre from "hardhat";

async function main() {
  const CONTRACT_ADDRESS = "0x841ef521c0509e3cf26629650472e0f82920953b";
  
  // Get wallet clients
  const [owner] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  // Get the deployed contract instance
  const gigabrainPasses = await hre.viem.getContractAt(
    "GigabrainPasses",
    CONTRACT_ADDRESS
  );

  console.log("Contract address:", gigabrainPasses.address);
  console.log("Current pass cost:", await gigabrainPasses.read.passCost());
  console.log("Total supply:", await gigabrainPasses.read.totalSupply());
  console.log("Max supply:", await gigabrainPasses.read.maxSupply());

  try {
    console.log("\nUpdating price to 9.99 USDC...");
    const tx = await gigabrainPasses.write.setPassCost([9_990_000n]);
    console.log("Transaction hash:", tx);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    
    const newPrice = await gigabrainPasses.read.passCost();
    console.log("New price:", newPrice.toString());
    
    if (newPrice === 9_990_000n) {
      console.log("✅ Price update successful!");
    } else {
      console.log("❌ Price update failed - price is still", newPrice.toString());
    }
  } catch (error) {
    console.error("Error updating price:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 