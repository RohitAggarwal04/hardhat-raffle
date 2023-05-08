const { ethers, network } = require("hardhat")

async function mockKeepers() {
    const raffle = await ethers.getContract("Raffle")
    const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(""))
    const { upKeepNeeded } = await raffle.callStatic.checkUpKeep(checkData)
    if (upKeepNeeded) {
        const tx = await raffle.performUpkeep(checkData)
        const txReciept = await tx.wait(1)
        const requestId = await txReciept.events[1].args.requestId
        console.log("perform upKeep with reuestId:" + requestId)

        if (network.chainId == 31337) {
            await mockvrf(requestId, raffle)
        }
    } else {
        console.log("UpKeep not needed!")
    }
}
async function mockvrf(requestId, raffle) {
    console.log("pretending to be chainlink keepers")
    const vrfCoordinatorV2 = await ethers.getContract("VRFCoordinatorV2Mock")
    await vrfCoordinatorV2.fullfillRandomWords(requestId, raffle.address)
    const recentWinner = await raffle.getRecentWinner()
    console.log(recentWinner)
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
