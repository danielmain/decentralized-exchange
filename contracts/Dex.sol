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
        uint256 amount;
        uint256 price;
    }

    mapping(bytes32 => mapping(uint256 => Order[])) public orderBook;

    function getOrderBook(bytes32 ticker, Side side) view public returns(Order[] memory){
        return orderBook[ticker][uint(side)];
    }

    function generateNewOrder(uint256 amount, uint256 price) view public returns(Order memory) {
        return Order(msg.sender, amount, price);
    }

    function hasSufficientBalanceForLimit(Side side, bytes32 ticker, uint256 amount, uint256 price) view public {
        if (side == Side.BUY) {
            require(balances[msg.sender][bytes32("ETH")] >= amount.mul(price), 'Insuffient eth balance');
        } else {
            require(balances[msg.sender][ticker] >= amount, 'Insuffient token balance');
        }
    }

    function hasSufficientBalanceForMarket(Side side, bytes32 ticker, uint256 amount) view public {
        if (side == Side.BUY) {
            require(balances[msg.sender][bytes32("ETH")] > 0, 'Insuffient eth balance');
        } else {
            require(balances[msg.sender][ticker] >= 1, 'Insuffient token balance');
        }
    }

    function isOrderBookEmpty(Side side, bytes32 ticker, uint256 amount) view public {
        if (side == Side.BUY) {
            require(orderBook[ticker][uint(Side.SELL)].length > 0, "The order book is empty for this operation");
        } else {
            require(orderBook[ticker][uint(Side.BUY)].length > 0, "The order book is empty for this operation");
        }
    }

   function createLimitOrder(Side side, bytes32 ticker, uint256 amount, uint256 price) public {
        hasSufficientBalanceForLimit(side, ticker, amount, price);
        orderBook[ticker][uint(side)].push(Order(msg.sender, amount, price));
    }

    function createSortedLimitOrder(Side side, bytes32 ticker, uint256 amount, uint256 price) public {
        hasSufficientBalanceForLimit(side, ticker, amount, price);
        addNewOrderInSortedPosition(orderBook[ticker][uint(side)], Order(msg.sender, amount, price));
    }

    function createMarketOrder(Side side, bytes32 ticker, uint256 amount) public {
        isOrderBookEmpty(side, ticker, amount);
        hasSufficientBalanceForMarket(side, ticker, amount);
        if (side == Side.BUY) {
            createBuyMarketOrder(uint(Side.SELL) ,ticker, amount);
        } else {
            createSellMarketOrder(uint(Side.BUY), ticker, amount);
        }
    }
    
    function getMyEthBalance() view public returns (uint256) {
        return balances[msg.sender][bytes32("ETH")];
    }

    function getMyTokenBalance(bytes32 ticker) view public returns (uint256) {
        return balances[msg.sender][ticker];
    }

    function createSellMarketOrder(uint side, bytes32 ticker, uint256 amount) public {
        uint256 amountFilled = amount;
        for (uint256 i = 0; i < orderBook[ticker][side].length && amountFilled > 0; i++) {
            address orderOwner = orderBook[ticker][side][i].trader;
            if (amountFilled <= orderBook[ticker][side][i].amount) {
                orderBook[ticker][side][i].amount = orderBook[ticker][side][i].amount.sub(amountFilled);
                balances[msg.sender][ticker] = balances[msg.sender][ticker].sub(amountFilled);
                balances[msg.sender][bytes32("ETH")] = balances[msg.sender][bytes32("ETH")].add(amountFilled.mul(orderBook[ticker][side][i].price));
                balances[orderOwner][ticker] = balances[orderOwner][ticker].add(amount);
                balances[orderOwner][bytes32("ETH")] = balances[orderOwner][bytes32("ETH")].sub(amountFilled.mul(orderBook[ticker][side][i].price));
                return;
            } else {
                amountFilled = amountFilled.sub(orderBook[ticker][side][i].amount);
                balances[msg.sender][ticker] = balances[msg.sender][ticker].sub(orderBook[ticker][side][i].amount);
                balances[msg.sender][bytes32("ETH")] = balances[msg.sender][bytes32("ETH")].add(amountFilled.mul(orderBook[ticker][side][i].price));
                balances[orderOwner][ticker] = balances[orderOwner][ticker].add(orderBook[ticker][side][i].amount);
                balances[orderOwner][bytes32("ETH")] = balances[orderOwner][bytes32("ETH")].sub(amountFilled.mul(orderBook[ticker][side][i].price));
                delete orderBook[ticker][side][i];
            }
        }
    }

    function createBuyMarketOrder(uint side, bytes32 ticker, uint256 amount) public {
        uint256 amountFilled = amount;
        for (uint256 i = 0; i < orderBook[ticker][side].length && amountFilled > 0; i++) {
            address orderOwner = orderBook[ticker][side][i].trader;
            if (amountFilled <= orderBook[ticker][side][i].amount) {
                orderBook[ticker][side][i].amount = orderBook[ticker][side][i].amount.sub(amountFilled);
                balances[msg.sender][ticker] = balances[msg.sender][ticker].add(amountFilled);
                balances[msg.sender][bytes32("ETH")] = balances[msg.sender][bytes32("ETH")].sub(amountFilled.mul(orderBook[ticker][side][i].price));
                balances[orderOwner][ticker] = balances[orderOwner][ticker].sub(amount);
                balances[orderOwner][bytes32("ETH")] = balances[orderOwner][bytes32("ETH")].add(amountFilled.mul(orderBook[ticker][side][i].price));
                return;
            } else {
                amountFilled = amountFilled.sub(orderBook[ticker][side][i].amount);
                balances[msg.sender][ticker] = balances[msg.sender][ticker].add(orderBook[ticker][side][i].amount);
                balances[msg.sender][bytes32("ETH")] = balances[msg.sender][bytes32("ETH")].sub(amountFilled.mul(orderBook[ticker][side][i].price));
                balances[orderOwner][ticker] = balances[orderOwner][ticker].sub(orderBook[ticker][side][i].amount);
                balances[orderOwner][bytes32("ETH")] = balances[orderOwner][bytes32("ETH")].add(amountFilled.mul(orderBook[ticker][side][i].price));
                delete orderBook[ticker][side][i];
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
        uint256 position = getPositionToPlace(orders, newOrder);
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