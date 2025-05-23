// import hre from "hardhat";

// async function main() {
//     console.log("Deploying GigabrainPasses");
    
//     // USDC token addresses for different networks
//     const usdcAddresses = {
//         // Base USDC
//         base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",

//         // Base Sepolia USDC
//         baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
//     };

//     // Get the network name
//     const network = await hre.network.name;
//     const usdcToken = usdcAddresses[network as keyof typeof usdcAddresses];

//     if (!usdcToken) {
//         throw new Error(`USDC address not found for network: ${network}`);
//     }

//     console.log(`Using USDC token address: ${usdcToken} on network: ${network}`);

//     // Deploy GigabrainPasses with USDC token address
//     const gigabrainPasses = await hre.viem.deployContract("GigabrainPasses", [usdcToken]);
//     console.log("GigabrainPasses deployed to:", gigabrainPasses.address);
// }

// // We recommend this pattern to be able to use async/await everywhere
// // and properly handle errors.
// main().catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });

import hre from "hardhat";

async function main() {
    console.log("Deploying GigabrainPasses");
    
    const usdcAddresses = {
        base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",       // ✅ Base mainnet USDC
        baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // 🧪 Base Sepolia
    };

    const governanceAddress = "0x7C30802686Ef76b59995a7Bac69274ACD67b4dA8";

    const network = await hre.network.name;
    const usdcToken = usdcAddresses[network as keyof typeof usdcAddresses];

    if (!usdcToken) {
        throw new Error(`USDC address not found for network: ${network}`);
    }

    console.log(`Using USDC token address: ${usdcToken} on network: ${network}`);
    console.log(`Governance address: ${governanceAddress}`);

    const gigabrainPasses = await hre.viem.deployContract("GigabrainPass", [usdcToken, governanceAddress]);
    console.log("GigabrainPass deployed to:", gigabrainPasses.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
