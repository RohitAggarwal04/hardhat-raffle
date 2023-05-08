const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { networkConfig, developmentChains } = require("../../helper-hardhat-config")

developmentChains.includes(network.name) &&
    describe("Raffle Unit Test", function () {
        let raffle, raffleContract, vrfCoordinatorV2Mock, raffleEntranceFee, interval, player
        const chainId = network.config.chainId

        beforeEach(async function () {
            // const { deployer } = await getNamedAccounts()
            accounts = await ethers.getSigners()
            player = accounts[1]

            await deployments.fixture("all")
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
            raffleContract = await ethers.getContract("Raffle")
            raffle = raffleContract.connect(player)
            interval = await raffle.getInterval()
            raffleEntranceFee = raffle.getEntranceFee()
        })
        describe("Constructor", function () {
            it("It initializes raffle correctly", async function () {
                const raffleState = (await raffle.getRaffleState()).toString()

                assert.equal(raffleState, "0")
                assert.equal(interval.toString(), networkConfig[chainId]["interval"])
            })
        })
        describe("Enter Raffle", function () {
            it("Reverts when you don't pay enough", async function () {
                await expect(raffle.enterRaffle()).to.be.revertedWith(
                    "Raffle__SendMoreToEnterRaffle"
                )
            })
            it("Records players when they enter", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                const contractPlayer = await raffle.getPlayer(0)
                assert.equal(player.address, contractPlayer)
            })
            it("emits event on enter", async function () {
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                    raffle,
                    "RaffleEnter"
                )
            })
            it("does not allow entering when raffle is closed ", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                // await network.provider.request({ method: "evm_mine", params: [] }) same as above
                // PRETEND TO BE CHAINLINK KEEPER
                await raffle.performUpkeep([])
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                    "Raffle__RaffleNotOpen"
                )
            })
        })
        describe("CheckUpKeep", async function () {
            it("Returns false if we have not sent any ETH", async function () {
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                assert(!upkeepNeeded)
            })
            it("Reverts if Raffle is not open", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                await raffle.performUpkeep([])
                const raffleState = (await raffle.getRaffleState()).toString()
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                assert.equal(raffleState, "1")
                assert(!upkeepNeeded)
            })
            it("returns false if enough time has not passed", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                assert(!upkeepNeeded)
            })
            it("returns true if has players,balance,time has passed and is open", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                assert(upkeepNeeded)
            })
        })
        describe("performUpKeep", function () {
            it("it can only run if checkUpKeep is true", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                const tx = await raffle.performUpkeep([])
                assert(tx)
            })
            it("reverts when checkUpkeep is false", async function () {
                await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNotNeeded")
            })
            it("updates raffle state, emits events and calls the vrf coordinator", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])

                const txRespone = await raffle.performUpkeep([])
                const txReciept = await txRespone.wait(1)
                const requestId = txReciept.events[1].args.requestId
                const raffleState = (await raffle.getRaffleState()).toString()

                assert(requestId.toNumber() > 0)
                assert.equal(raffleState, "1")
            })
        })
        describe("fullFillRandomWords", function () {
            beforeEach(async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
            })
            // it("can only be called after performUpKeep ", async function () {
            //     await expect(
            //         await vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
            //     ).to.be.revertedWith("nonexistent request")

            //     await expect(
            //         await vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
            //     ).to.be.revertedWith("nonexistent request")
            // })
            it("picks a winner,resets and sends money", async function () {
                const AdditionalEntrances = 3
                const startingIndex = 2
                for (let i = startingIndex; i < startingIndex + AdditionalEntrances; i++) {
                    raffle = raffleContract.connect(accounts[i])
                    await raffle.enterRaffle({ value: raffleEntranceFee })
                }
                const startingTimeStamp = await raffle.getLastTimeStamp()
                await new Promise(async (resolve, reject) => {
                    raffle.once("WinnerPicked", async () => {
                        console.log("WinnerPicked event fired")

                        try {
                            const recentWinner = await raffle.getRecentWinner()
                            console.log(recentWinner)
                            console.log("-------------------")
                            console.log(accounts[1].address)
                            console.log(accounts[2].address)
                            console.log(accounts[3].address)
                            console.log(accounts[0].address)

                            const endingTimeStamp = await raffle.getLastTimeStamp()
                            const players = await raffle.getNumberOfPlayers()
                            const raffleState = await raffle.getRaffleState()
                            const endingBalance = await accounts[2].getBalance()

                            assert.equal(players.toString(), "0")
                            assert(endingTimeStamp > startingTimeStamp)
                            assert.equal(raffleState, 0)
                            assert.equal(
                                endingBalance,
                                startingBalance.add(
                                    raffleEntranceFee
                                        .mul(additionalEntrances)
                                        .add(raffleEntranceFee)
                                )
                            )
                            resolve()
                        } catch (e) {
                            reject(e)
                        }
                    })
                    const tx = await raffle.performUpkeep([])
                    const txReciept = await tx.wait(1)
                    const startingBalance = await accounts[2].getBalance()
                    await vrfCoordinatorV2Mock.fullfillRandomWords(
                        txReciept.events[1].args.requestId,
                        raffle.address
                    )
                })
            })
        })
    })
