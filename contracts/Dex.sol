// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
pragma experimental ABIEncoderV2;

import "../contracts/Wallet.sol";

contract Dex is Wallet {

    using SafeMath for uint256;

    enum Side {
        BUY,
        SELL
    }

    struct Order {
        address trader;
        uint amount;
        uint price;
    }

    mapping(bytes32 => mapping(uint => Order[])) public orderBook;

    function getOrderBook(bytes32 ticker, Side side) view public returns(Order[] memory){
        return orderBook[ticker][uint(side)];
    }

    function generateNewOrder(uint amount, uint price) view public returns(Order memory) {
        return Order(msg.sender, amount, price);
    }

    function hasSufficientBalanceForLimit(Side side, bytes32 ticker, uint amount, uint price) view public {
        if (side == Side.BUY) {
            require(balances[msg.sender][bytes32("ETH")] >= amount.mul(price), 'Insuffient eth balance');
        } else {
            require(balances[msg.sender][ticker] >= amount, 'Insuffient token balance');
        }
    }

    function hasSufficientBalanceForMarket(Side side, bytes32 ticker, uint amount) view public {
        if (side == Side.BUY) {
            require(balances[msg.sender][bytes32("ETH")] >= 0, 'Insuffient eth balance');
        } else {
            require(balances[msg.sender][ticker] >= 1, 'Insuffient token balance');
        }
    }

    function isOrderBookEmpty(Side side, bytes32 ticker, uint amount) view public {
        if (side == Side.BUY) {
            require(orderBook[ticker][uint(Side.SELL)].length > 0, "The order book is empty for this operation");
        } else {
            require(orderBook[ticker][uint(Side.BUY)].length > 0, "The order book is empty for this operation");
        }
    }

   function createLimitOrder(Side side, bytes32 ticker, uint amount, uint price) public {
        hasSufficientBalanceForLimit(side, ticker, amount, price);
        orderBook[ticker][uint(side)].push(Order(msg.sender, amount, price));
    }

    function createSortedLimitOrder(Side side, bytes32 ticker, uint amount, uint price) public {
        hasSufficientBalanceForLimit(side, ticker, amount, price);
        addNewOrderInSortedPosition(orderBook[ticker][uint(side)], Order(msg.sender, amount, price));
    }

    function createMarketOrder(Side side, bytes32 ticker, uint amount) public {
        isOrderBookEmpty(side, ticker, amount);
        hasSufficientBalanceForMarket(side, ticker, amount);
        // if (side == Side.BUY) {
        //     createBuyMarketOrder(side, ticker, amount);
        // } else {
        //     createSellMarketOrder(side, ticker, amount);
        // }
    }

    function createBuyMarketOrder(Side side, bytes32 ticker, uint amount) public {
        for (uint256 i = 0; i < orderBook[ticker][uint(side)].length && amount > 0; i++) {
            address seller = orderBook[ticker][uint(side)][i].trader;
            if (amount < orderBook[ticker][uint(side)][i].amount) {
                orderBook[ticker][uint(side)][i].amount.sub(amount);
                balances[msg.sender][ticker].add(amount);
                balances[seller][ticker].sub(amount);
            } else {
                amount = amount - orderBook[ticker][uint(side)][i].amount;
                orderBook[ticker][uint(side)][i].amount.sub(amount);
                balances[msg.sender][ticker].add(amount);
                balances[seller][ticker].sub(amount);
                delete orderBook[ticker][uint(side)][i];
            }
        }
    }

    function createSellMarketOrder(Side side, bytes32 ticker, uint amount) public {
        for (uint256 i = 0; i < orderBook[ticker][uint(side)].length && amount > 0; i++) {
            address buyer = orderBook[ticker][uint(side)][i].trader;
            if (amount < orderBook[ticker][uint(side)][i].amount) {
                orderBook[ticker][uint(side)][i].amount.sub(amount);
                balances[buyer][ticker].add(amount);
                balances[msg.sender][ticker].sub(amount);
            } else {
                amount = amount - orderBook[ticker][uint(side)][i].amount;
                orderBook[ticker][uint(side)][i].amount.sub(amount);
                balances[buyer][ticker].add(amount);
                balances[msg.sender][ticker].sub(amount);
                delete orderBook[ticker][uint(side)][i];
            }
        }
    }

    function getTokenBalance(bytes32 token) public returns (uint) {
        return balances[msg.sender][token];
    }

    function resetOrderBook(bytes32 ticker, Side side) view public returns(Order[] memory){
        return orderBook[ticker][uint(side)];
    }

    // Find the middle position between two orders in a sorted order list
    function isMiddlePosition(Order memory prevOrder, Order memory newOrder, Order memory nextOrder) public pure returns(bool) {
        return prevOrder.price >= newOrder.price && newOrder.price >= nextOrder.price;
    }

    function getPositionToPlace(Order[] memory orders, Order memory newOrder) public pure returns(uint) {
        // If array is empty
        if (orders.length == 0) {
            return 0;
        // If array has only 1 element
        } else if (orders.length == 1) {
            if (orders[0].price > newOrder.price) {
                return 1;
            }
            return 0;
        }
        // If array has more than 2 elements
        for (uint256 i = 0; i < orders.length; i++) {
            // We reach end of the array
            if (i == orders.length - 1) {
                return orders.length;
            }
            if (isMiddlePosition(orders[i], newOrder, orders[i+1])) {
                return i+1;
            }
        }
    }

    function addNewOrderInSortedPosition(Order[] storage orders, Order memory newOrder) internal {
        uint position = getPositionToPlace(orders, newOrder);
        if (position >= orders.length) {
            orders.push(newOrder);
        } else {
            for (uint256 i = (orders.length - 1); i >= position; i--) {
                orders[i+1] = orders[i];
            }
            orders[position] = newOrder;
        }
    }

}