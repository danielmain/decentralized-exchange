const _ = require('lodash');
const { accounts, contract } = require('@openzeppelin/test-environment');
const Web3Utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');

const Side = {
    BUY: 0,
    SELL: 1,
};

const Tokens = {
    LINK: Web3Utils.fromUtf8("LINK"),
}

const Dex = contract.fromArtifact('Dex');
let dex;

const Link = contract.fromArtifact('Link');
let link;

describe('Dex', function () {
    const [owner] = accounts;
    beforeEach(async function () {
        dex = await Dex.new({ from: owner });
        link = await Link.new({ from: owner });
    });

    it("should determine if the order fits in the middle position between two orders sorted by price", async () => {
        const lowPriceOrder = await dex.generateNewOrder(10, 15);
        const highPriceOrder = await dex.generateNewOrder(10, 45);
        const newMiddleOrder = await dex.generateNewOrder(10, 20);

        let result = await dex.isMiddlePosition(highPriceOrder, newMiddleOrder, lowPriceOrder);
        expect(result).toBeTruthy();

        const newSmallerOrder = await dex.generateNewOrder(10, 10);
        result = await dex.isMiddlePosition(highPriceOrder, newSmallerOrder, lowPriceOrder);
        expect(result).toBeFalsy();

        const newHigherOrder = await dex.generateNewOrder(10, 50);
        result = await dex.isMiddlePosition(highPriceOrder, newHigherOrder, lowPriceOrder);
        expect(result).toBeFalsy();
        result = await dex.isMiddlePosition(newHigherOrder, highPriceOrder, lowPriceOrder);
        expect(result).toBeTruthy();

        result = await dex.isMiddlePosition(highPriceOrder, lowPriceOrder, lowPriceOrder);
        expect(result).toBeTruthy();
        result = await dex.isMiddlePosition(highPriceOrder, highPriceOrder, lowPriceOrder);
        expect(result).toBeTruthy();
    });

    it("should get the correct position to place an order if orderbook is empty", async () => {
        await dex.addToken(Tokens.LINK, link.address, { from: accounts[0] });
        await dex.depositEth({ value: 2000 });

        let orderbook = await dex.getOrderBook(Tokens.LINK, Side.BUY);
        let newOrder;
        let position;

        newOrder = await dex.generateNewOrder(10, 45);
        position = await dex.getPositionToPlace(orderbook, newOrder);
        expect(position.toNumber()).toBe(0);

        newOrder = await dex.generateNewOrder(10, 35);
        position = await dex.getPositionToPlace(orderbook, newOrder);
        expect(position.toNumber()).toBe(0);

        newOrder = await dex.generateNewOrder(10, 55);
        position = await dex.getPositionToPlace(orderbook, newOrder);

        expect(position.toNumber()).toBe(0);
    });

    it("should get the correct position to place an order if orderbook has 1 order already", async () => {
        await dex.addToken(Tokens.LINK, link.address, { from: accounts[0] });
        await dex.depositEth({ value: 2000 });

        await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 50);

        let orderbook = await dex.getOrderBook(Tokens.LINK, Side.BUY);
        let newOrder;
        let position;

        newOrder = await dex.generateNewOrder(10, 45);
        position = await dex.getPositionToPlace(orderbook, newOrder);
        expect(position.toNumber()).toBe(1);

        newOrder = await dex.generateNewOrder(10, 35);
        position = await dex.getPositionToPlace(orderbook, newOrder);
        expect(position.toNumber()).toBe(1);

        newOrder = await dex.generateNewOrder(10, 55);
        position = await dex.getPositionToPlace(orderbook, newOrder);

        expect(position.toNumber()).toBe(0);

    });

    it("should get the correct position to place an order if orderbook has more than 2 orders already", async () => {
        await dex.addToken(Tokens.LINK, link.address, { from: accounts[0] });
        await dex.depositEth({ value: 2000 });

        await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 50);
        await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 40);
        await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 30);

        let orderbook = await dex.getOrderBook(Tokens.LINK, Side.BUY);
        let newOrder;
        let position;

        newOrder = await dex.generateNewOrder(10, 45);
        position = await dex.getPositionToPlace(orderbook, newOrder);
        expect(position.toNumber()).toBe(1);

        newOrder = await dex.generateNewOrder(10, 35);
        position = await dex.getPositionToPlace(orderbook, newOrder);
        expect(position.toNumber()).toBe(2);

        newOrder = await dex.generateNewOrder(10, 55);
        position = await dex.getPositionToPlace(orderbook, newOrder);
        
        expect(position.toNumber()).toBe(3);
    });

    it("createSortedLimitOrder should work when orderbook is empty", async () => {
        await dex.addToken(Tokens.LINK, link.address, { from: accounts[0] });
        await dex.depositEth({ value: 2000 });
        let orderbook = await dex.getOrderBook(Tokens.LINK, Side.BUY);

        let result = _.find(orderbook, (value, index, array) => index !== 0 && array[index - 1].price <= value.price);
        expect(result).toBeFalsy();

        await dex.createSortedLimitOrder(Side.BUY, Tokens.LINK, 10, 45);

        orderbook = await dex.getOrderBook(Tokens.LINK, Side.BUY);
        expect(orderbook.length).toBe(1)
    });

    it("should have a positive ETH balance before creating BUY limit order", async () => {
        await dex.addToken(Tokens.LINK, link.address, { from: accounts[0] });
        await truffleAssert.reverts(
            dex.createLimitOrder(Side.BUY, Tokens.LINK, 100, 60)
        );
        await dex.depositEth({ value: 2000 });
        await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 30);
        const orderbook = await dex.getOrderBook(Tokens.LINK, Side.BUY);
        expect(orderbook.length).toBe(1)
    });

    it("should have enough balance before selling the token", async () => {
        await dex.addToken(Tokens.LINK, link.address, { from: accounts[0] });
        await truffleAssert.reverts(
            dex.createLimitOrder(Side.SELL, Tokens.LINK, 100, 100)
        );
        await link.approve(dex.address, 100, { from: accounts[0] });
        await dex.deposit(10, Tokens.LINK, { from: accounts[0] });
        truffleAssert.passes(
            await dex.createLimitOrder(Side.SELL, Tokens.LINK, 2, 51, { from: accounts[0] })
        );

    });
});

