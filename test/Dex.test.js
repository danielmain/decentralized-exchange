const _ = require('lodash');
const Dex = artifacts.require("Dex")
const Link = artifacts.require("Link")
const truffleAssert = require('truffle-assertions');

const Side = {
    BUY: 0,
    SELL: 1,
};

const Tokens = {
    LINK: web3.utils.fromUtf8("LINK"),
}

contract("Dex", accounts => {
    describe("When order book get sorted", async () => {

        it("should determine if the order fits in the middle position between two orders sorted by price", async () => {
            const dex = await Dex.deployed();

            const lowPriceOrder = await dex.generateNewOrder(10, 15);
            const highPriceOrder = await dex.generateNewOrder(10, 45);
            const newMiddleOrder = await dex.generateNewOrder(10, 20);

            let result = await dex.isMiddlePosition(highPriceOrder, newMiddleOrder, lowPriceOrder);
            assert(result);

            const newSmallerOrder = await dex.generateNewOrder(10, 10);
            result = await dex.isMiddlePosition(highPriceOrder, newSmallerOrder, lowPriceOrder);
            assert(!result);

            const newHigherOrder = await dex.generateNewOrder(10, 50);
            result = await dex.isMiddlePosition(highPriceOrder, newHigherOrder, lowPriceOrder);
            assert(!result);
            result = await dex.isMiddlePosition(newHigherOrder, highPriceOrder, lowPriceOrder);
            assert(result);

            result = await dex.isMiddlePosition(highPriceOrder, lowPriceOrder, lowPriceOrder);
            assert(result);
            result = await dex.isMiddlePosition(highPriceOrder, highPriceOrder, lowPriceOrder);
            assert(result);

            console.log('result', result);
        });

        it("should get the correct position to place an order if orderbook has more than 2 orders already", async () => {
            const dex = await Dex.deployed();
            const link = await Link.deployed();
            await dex.addToken(Tokens.LINK, link.address,  {from: accounts[0]});
            dex.depositEth({ value: 2000 });

            await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 50);
            await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 40);
            await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 30);

            let orderbook = await dex.getOrderBook(Tokens.LINK,Side.BUY);
            let newOrder;
            let position;

            newOrder = await dex.generateNewOrder(10, 45);
            position = await dex.getPositionToPlace(orderbook, newOrder);
            assert(position.toNumber() == 1);

            newOrder = await dex.generateNewOrder(10, 35);
            position = await dex.getPositionToPlace(orderbook, newOrder);
            assert(position.toNumber() == 2);

            newOrder = await dex.generateNewOrder(10, 55);
            position = await dex.getPositionToPlace(orderbook, newOrder);

            assert(position.toNumber() == 3);
        });

        it("should get the correct position to place an order if orderbook has 1 order already", async () => {
            const dex = await Dex.deployed();
            const link = await Link.deployed();
            await dex.addToken(Tokens.LINK, link.address,  {from: accounts[0]});
            dex.depositEth({ value: 2000 });

            await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 50);

            let orderbook = await dex.getOrderBook(Tokens.LINK,Side.BUY);
            let newOrder;
            let position;

            newOrder = await dex.generateNewOrder(10, 45);
            position = await dex.getPositionToPlace(orderbook, newOrder);
            assert(position.toNumber() == 1);

            newOrder = await dex.generateNewOrder(10, 35);
            position = await dex.getPositionToPlace(orderbook, newOrder);
            assert(position.toNumber() == 1);

            newOrder = await dex.generateNewOrder(10, 55);
            position = await dex.getPositionToPlace(orderbook, newOrder);
            console.log('position', position.toNumber());

            assert(position.toNumber() == 0);
        });

        it("should get the correct position to place an order if orderbook is empty", async () => {
            const dex = await Dex.deployed();
            const link = await Link.deployed();
            await dex.addToken(Tokens.LINK, link.address,  {from: accounts[0]});
            dex.depositEth({ value: 2000 });

            let orderbook = await dex.getOrderBook(Tokens.LINK,Side.BUY);
            let newOrder;
            let position;

            newOrder = await dex.generateNewOrder(10, 45);
            position = await dex.getPositionToPlace(orderbook, newOrder);
            assert(position.toNumber() == 0);

            newOrder = await dex.generateNewOrder(10, 35);
            position = await dex.getPositionToPlace(orderbook, newOrder);
            assert(position.toNumber() == 0);

            newOrder = await dex.generateNewOrder(10, 55);
            position = await dex.getPositionToPlace(orderbook, newOrder);
            console.log('position', position.toNumber());

            assert(position.toNumber() == 0);
        });

        it("should sort when orders is empty", async () => {
            const dex = await Dex.deployed();
            const link = await Link.deployed();
            await dex.addToken(Tokens.LINK, link.address,  {from: accounts[0]});
            dex.depositEth({ value: 2000 });

            await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 50);
            await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 40);
            await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 30);

            let orderbook = await dex.getOrderBook(Tokens.LINK,Side.BUY);

            let result = _.find(orderbook, (value, index, array) => index !== 0 && array[index - 1].price <= value.price);
            assert(!result);

            await dex.createSortedLimitOrder(Side.BUY, Tokens.LINK, 10, 45);

            orderbook = await dex.getOrderBook(Tokens.LINK,Side.BUY);
            result = _.find(orderbook, (value, index, array) => index !== 0 && array[index - 1].price <= value.price);
            // assert(!newSortedResult);
            console.log('orderbook', orderbook);

        });
    });

    describe("when a user whants make an buy/sell operation", async () => {
        
        xit("should have a positive ETH balance before creating BUY limit order", async () => {
            const dex = await Dex.deployed();
            const link = await Link.deployed();
            await dex.addToken(Tokens.LINK, link.address,  {from: accounts[0]});

            await truffleAssert.reverts(
                dex.createLimitOrder(Side.BUY, Tokens.LINK, 100, 60)
            );
            dex.depositEth({ value: 2000 })
            await truffleAssert.passes(
                dex.createLimitOrder(Side.BUY, Tokens.LINK, 100, 60)
            )
        });

        xit("should have enough balance before selling the token", async () => {
            const dex = await Dex.deployed();
            const link = await Link.deployed();
            await dex.addToken(Tokens.LINK, link.address,  {from: accounts[0]});

            await truffleAssert.reverts(
                dex.createLimitOrder(Side.SELL, Tokens.LINK, 100, 100)
            )
            await link.approve(dex.address, 1000);
            await dex.deposit(100, Tokens.LINK);
            truffleAssert.passes(
                 await dex.createLimitOrder(Side.SELL, Tokens.LINK, 99, 51)
            )
        });

        xit("The BUY order book should be sorted by highest to lowest ascending", async () => {
            const dex = await Dex.deployed();
            const link = await Link.deployed();
            await dex.addToken(Tokens.LINK, link.address,  {from: accounts[0]});
            await link.approve(dex.address, 1000);

            await _.reduce(
                [
                    {side: Side.BUY, token: Tokens.LINK, amount: 120, price: 40},
                    {side: Side.BUY, token: Tokens.LINK, amount: 129, price: 39},
                    {side: Side.BUY, token: Tokens.LINK, amount: 130, price: 30},
                    {side: Side.BUY, token: Tokens.LINK, amount: 140, price: 20},
                ], 
                async (_, order) => dex.createLimitOrder(order.side, order.token, order.amount, order.price), 
                Promise.resolve()
            );

            const orderbook = await dex.getOrderBook(Tokens.LINK, Side.BUY);

            const result = _.find(orderbook, (value, index, array) => index !== 0 && array[index - 1].price <= value.price);
            assert(!result);
        });

        xit("The SELL order book should be sorted by lowest to highest ascending", async () => {
            const dex = await Dex.deployed();
            const link = await Link.deployed();
            await dex.addToken(Tokens.LINK, link.address,  {from: accounts[0]});
            await link.approve(dex.address, 1000);
            await dex.deposit(99, Tokens.LINK);
            await _.reduce(
                [
                    {side: Side.SELL, token: Tokens.LINK, amount: 12, price: 10},
                    {side: Side.SELL, token: Tokens.LINK, amount: 19, price: 19},
                    {side: Side.SELL, token: Tokens.LINK, amount: 13, price: 20},
                    {side: Side.SELL, token: Tokens.LINK, amount: 14, price: 30},
                ], 
                async (_, order) => dex.createLimitOrder(order.side, order.token, order.amount, order.price), 
                Promise.resolve()
            );

            const orderbook = await dex.getOrderBook(Tokens.LINK, Side.SELL);
            console.log('orderbook', orderbook);
            const result = _.find(orderbook, (value, index, array) => index !== 0 && array[index - 1].price >= value.price);
            assert(!result);
        });
    });

})
