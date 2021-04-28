const _ = require('lodash');
const { ethers } = require('hardhat');
const { expect } = require('chai');
const Web3Utils = require('web3-utils');
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const Side = {
    BUY: 0,
    SELL: 1,
};

const Tokens = {
    LINK: ethers.utils.formatBytes32String('LINK'),
}

let dex;
let link;
let owner;
let addr1;
let addr2;

describe('Dex handling market orders', function () {
    beforeEach(async function () {
        const Dex = await ethers.getContractFactory('Dex');
        const Link = await ethers.getContractFactory('Link');
        dex = await Dex.deploy();
        link = await Link.deploy();
        [owner, addr1] = await ethers.getSigners();
    });

    it('cannot plase a market BUY order if orderbook is empty', async () => {
        await dex.connect(addr1).depositEth({ value: 2000 });
        await expect(
            dex.connect(addr1).createMarketOrder(Side.BUY, Tokens.LINK, 2)
        ).to.be.revertedWith('The order book is empty for this operation');
        await dex.connect(owner).addToken(Tokens.LINK, link.address);
        await link.connect(owner).approve(dex.address, 100);
        await dex.connect(owner).deposit(100, Tokens.LINK);
        await dex.connect(owner).createLimitOrder(Side.SELL, Tokens.LINK, 90, 100);
        await dex.connect(addr1).createMarketOrder(Side.BUY, Tokens.LINK, 2);
    });

    it('should have enough eth balance before placing a market BUY order', async () => {
        await dex.connect(owner).addToken(Tokens.LINK, link.address);
        await link.connect(owner).approve(dex.address, 100);
        await dex.connect(owner).deposit(100, Tokens.LINK);
        await expect(
            dex.connect(addr1).createMarketOrder(Side.BUY, Tokens.LINK, 100)
        ).to.be.revertedWith('The order book is empty for this operation');
        await dex.connect(owner).createLimitOrder(Side.SELL, Tokens.LINK, 90, 100);
        await expect(
            dex.connect(addr1).createMarketOrder(Side.BUY, Tokens.LINK, 100)
        ).to.be.revertedWith('Insuffient eth balance');
        await dex.connect(addr1).depositEth({ value: 2000 });
        await dex.connect(addr1).createMarketOrder(Side.BUY, Tokens.LINK, 100);
    });

    it('should have enough token balance before placing a market SELL order', async () => {
        await dex.connect(owner).addToken(Tokens.LINK, link.address);
        await link.connect(owner).approve(dex.address, 100);
        await expect(
            dex.connect(owner).createMarketOrder(Side.SELL, Tokens.LINK, 100)
        ).to.be.revertedWith('The order book is empty for this operation');
        await dex.connect(addr1).depositEth({ value: 20000 });
        await dex.connect(owner).deposit(100, Tokens.LINK);
        await dex.connect(addr1).createLimitOrder(Side.BUY, Tokens.LINK, 50, 100);
        await dex.connect(owner).createMarketOrder(Side.SELL, Tokens.LINK, 50)
    });

});

describe('Dex handling limit orders', function () {
    beforeEach(async function () {
        const Dex = await ethers.getContractFactory('Dex');
        const Link = await ethers.getContractFactory('Link');
        dex = await Dex.deploy();
        link = await Link.deploy();
        [owner, addr1] = await ethers.getSigners();
    });

    it('should determine if the order fits in the middle position between two orders sorted by price', async () => {
        const lowPriceOrder = await dex.generateNewOrder(10, 15);
        const highPriceOrder = await dex.generateNewOrder(10, 45);
        const newMiddleOrder = await dex.generateNewOrder(10, 20);

        let result = await dex.isMiddlePosition(highPriceOrder, newMiddleOrder, lowPriceOrder);
        expect(result).to.be.true;

        const newSmallerOrder = await dex.generateNewOrder(10, 10);
        result = await dex.isMiddlePosition(highPriceOrder, newSmallerOrder, lowPriceOrder);
        expect(result).to.be.false;

        const newHigherOrder = await dex.generateNewOrder(10, 50);
        result = await dex.isMiddlePosition(highPriceOrder, newHigherOrder, lowPriceOrder);
        expect(result).to.be.false;
        result = await dex.isMiddlePosition(newHigherOrder, highPriceOrder, lowPriceOrder);
        expect(result).to.be.true;

        result = await dex.isMiddlePosition(highPriceOrder, lowPriceOrder, lowPriceOrder);
        expect(result).to.be.true;
        result = await dex.isMiddlePosition(highPriceOrder, highPriceOrder, lowPriceOrder);
        expect(result).to.be.true;
    });

    it('should get the correct position to place an order if orderbook is empty', async () => {
        await dex.connect(owner).addToken(Tokens.LINK, link.address);
        await dex.depositEth({ value: 2000 });

        let orderbook = await dex.getOrderBook(Tokens.LINK, Side.BUY);
        let newOrder;
        let position;

        newOrder = await dex.generateNewOrder(10, 45);
        position = await dex.getPositionToPlace(orderbook, newOrder);
        expect(position.toNumber()).to.be.equal(0);

        newOrder = await dex.generateNewOrder(10, 35);
        position = await dex.getPositionToPlace(orderbook, newOrder);
        expect(position.toNumber()).to.be.equal(0);

        newOrder = await dex.generateNewOrder(10, 55);
        position = await dex.getPositionToPlace(orderbook, newOrder);

        expect(position.toNumber()).to.be.equal(0);
    });

    it('should get the correct position to place an order if orderbook has 1 order already', async () => {
        await dex.addToken(Tokens.LINK, link.address, { from: owner.address });
        await dex.depositEth({ value: 2000 });

        await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 50);

        let orderbook = await dex.getOrderBook(Tokens.LINK, Side.BUY);
        let newOrder;
        let position;

        newOrder = await dex.generateNewOrder(10, 45);
        position = await dex.getPositionToPlace(orderbook, newOrder);
        expect(position.toNumber()).to.be.equal(1);

        newOrder = await dex.generateNewOrder(10, 35);
        position = await dex.getPositionToPlace(orderbook, newOrder);
        expect(position.toNumber()).to.be.equal(1);

        newOrder = await dex.generateNewOrder(10, 55);
        position = await dex.getPositionToPlace(orderbook, newOrder);

        expect(position.toNumber()).to.be.equal(0);

    });

    it('should get the correct position to place an order if orderbook has more than 2 orders already', async () => {
        await dex.addToken(Tokens.LINK, link.address, { from: owner.address });
        await dex.depositEth({ value: 2000 });

        await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 50);
        await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 40);
        await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 30);

        let orderbook = await dex.getOrderBook(Tokens.LINK, Side.BUY);
        let newOrder;
        let position;

        newOrder = await dex.generateNewOrder(10, 45);
        position = await dex.getPositionToPlace(orderbook, newOrder);
        expect(position.toNumber()).to.be.equal(1);

        newOrder = await dex.generateNewOrder(10, 35);
        position = await dex.getPositionToPlace(orderbook, newOrder);
        expect(position.toNumber()).to.be.equal(2);

        newOrder = await dex.generateNewOrder(10, 55);
        position = await dex.getPositionToPlace(orderbook, newOrder);
        
        expect(position.toNumber()).to.be.equal(3);
    });

    it('createSortedLimitOrder should work when orderbook is empty', async () => {
        await dex.connect(owner).addToken(Tokens.LINK, link.address);
        await dex.depositEth({ value: 2000 });
        let orderbook = await dex.getOrderBook(Tokens.LINK, Side.BUY);

        let result = _.find(orderbook, (value, index, array) => index !== 0 && array[index - 1].price <= value.price);
        expect(result).to.be.undefined;

        await dex.createSortedLimitOrder(Side.BUY, Tokens.LINK, 10, 45);

        orderbook = await dex.getOrderBook(Tokens.LINK, Side.BUY);
        expect(orderbook.length).to.be.equal(1)
    });

    it('should have a positive ETH balance before creating BUY limit order', async () => {
        await dex.connect(owner).addToken(Tokens.LINK, link.address);
        await expect(
            dex.createLimitOrder(Side.BUY, Tokens.LINK, 100, 60)
        ).to.be.revertedWith('Insuffient eth balance');
        await dex.depositEth({ value: 2000 });
        await dex.createLimitOrder(Side.BUY, Tokens.LINK, 10, 30);
        const orderbook = await dex.getOrderBook(Tokens.LINK, Side.BUY);
        expect(orderbook.length).to.be.equal(1);
    });

    it('should have enough balance before placing a limit SELL order', async () => {
        await dex.connect(owner).addToken(Tokens.LINK, link.address);
        await expect(
            dex.createLimitOrder(Side.SELL, Tokens.LINK, 100, 100)
        ).to.be.revertedWith('Insuffient token balance');
        let orderbook = await dex.getOrderBook(Tokens.LINK, Side.SELL);
        expect(orderbook.length).to.be.equal(0);

        await link.approve(dex.address, 100, { from: owner.address });
        await dex.connect(owner).deposit(10, Tokens.LINK);
        await dex.connect(owner).createLimitOrder(Side.SELL, Tokens.LINK, 2, 51)
        orderbook = await dex.getOrderBook(Tokens.LINK, Side.SELL);
        expect(orderbook.length).to.be.equal(1);
    });

});
