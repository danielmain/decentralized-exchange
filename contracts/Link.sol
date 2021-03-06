// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import './token/ERC20/ERC20.sol';

contract Link is ERC20 {
    constructor() ERC20("Chainlink", "LINK") {
        _mint(msg.sender, 1000);
    }
}
