const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { networkConfig, developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name) &&
    describe("Raffle Unit Test", function () {
        let raffle, raffleEntranceFee

        beforeEach(async function () {
            const { deployer } = await getNamedAccounts()
            raffle = await ethers.getContract("Raffle", deployer)
            raffleEntranceFee = raffle.getEntranceFee()
        }),
            describe("fulfillRandomWords", function () {
                it("works with live chainlink keepers and chainlink VRF,we get a random winner", async function () {
                    const startingTimeStamp = await raffle.getLastTimeStamp()
                    const accounts = await ethers.getSigners()

                    await new Promise(async (resolve, reject) => {
                        raffle.once("WinnerPicked", async function () {
                            console.log("WinnerPicked event detected")
                            try {
                                const recentWinner = await raffle.getRecentWinner()
                                const endingTimeStamp = await raffle.getLastTimeStamp()
                                const raffleState = await raffle.getRaffleState()

                                assert.equal(recentWinner.toString(), accounts[0].address)
                                assert.equal(raffleState, 0)
                                assert(endingTimeStamp > startingTimeStamp)
                                resolve()
                            } catch (e) {
                                console.log(e)
                                reject(e)
                            }
                        })

                        const tx = await raffle.enterRaffle({ value: raffleEntranceFee })
                        await tx.wait(1)
                    })
                })
            })
    })
