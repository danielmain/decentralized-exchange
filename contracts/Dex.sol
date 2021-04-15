// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
pragma experimental ABIEncoderV2;

import "./Wallet.sol";

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

   function createLimitOrder(Side side, bytes32 ticker, uint amount, uint price) public {
        if (side == Side.BUY) {
            require(balances[msg.sender][bytes32("ETH")] >= amount.mul(price), 'Insuffient eth balance');
        } else {
            require(balances[msg.sender][ticker] >= amount, 'Insuffient token balance');
        }
        orderBook[ticker][uint(side)].push(Order(msg.sender, amount, price));
    }

    function createSortedLimitOrder(Side side, bytes32 ticker, uint amount, uint price) public {
        if (side == Side.BUY) {
            require(balances[msg.sender][bytes32("ETH")] >= amount.mul(price), 'Insuffient eth balance');
        } else {
            require(balances[msg.sender][ticker] >= amount, 'Insuffient token balance');
        }
        addNewOrderInSortedPosition(orderBook[ticker][uint(side)], Order(msg.sender, amount, price));
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