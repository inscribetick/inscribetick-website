// Generated from the compiled $TICK contracts (forge build).
export const TICK_MINT_ABI = [
 {
  "type": "constructor",
  "inputs": [
   {
    "name": "_pricePerInscribe",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "_startTime",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "_mintDuration",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "_whype",
    "type": "address",
    "internalType": "contract IWHYPE"
   },
   {
    "name": "_poolManager",
    "type": "address",
    "internalType": "contract IPoolManager"
   },
   {
    "name": "_feeRecipient",
    "type": "address",
    "internalType": "address"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "FINALIZE_GRACE",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "INSCRIPTION",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "string",
    "internalType": "string"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "LP_TOKENS_PER_INSCRIBE",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "MAX_INSCRIBES",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "MAX_PER_WALLET",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "TOKENS_PER_INSCRIBE",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "endTime",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "finalize",
  "inputs": [],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "finalized",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "inscribe",
  "inputs": [
   {
    "name": "count",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "payable"
 },
 {
  "type": "function",
  "name": "inscribed",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "inscribedBy",
  "inputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "locker",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract TickLocker"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "mintDuration",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "mintOpen",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "pricePerInscribe",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "refund",
  "inputs": [],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "remainingFor",
  "inputs": [
   {
    "name": "wallet",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "startTime",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "token",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract TickToken"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "whype",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IWHYPE"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "event",
  "name": "Finalized",
  "inputs": [
   {
    "name": "inscribesSold",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "tokensBurned",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "lpTokens",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "lpHype",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Inscribe",
  "inputs": [
   {
    "name": "minter",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "id",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "inscription",
    "type": "string",
    "indexed": false,
    "internalType": "string"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Refunded",
  "inputs": [
   {
    "name": "minter",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "inscribes",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "hype",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "error",
  "name": "AlreadyFinalized",
  "inputs": []
 },
 {
  "type": "error",
  "name": "FinalizeExpired",
  "inputs": []
 },
 {
  "type": "error",
  "name": "InvalidCount",
  "inputs": []
 },
 {
  "type": "error",
  "name": "MintClosed",
  "inputs": []
 },
 {
  "type": "error",
  "name": "MintNotOpen",
  "inputs": []
 },
 {
  "type": "error",
  "name": "MintStillRunning",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NothingToRefund",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ReentrancyGuardReentrantCall",
  "inputs": []
 },
 {
  "type": "error",
  "name": "RefundFailed",
  "inputs": []
 },
 {
  "type": "error",
  "name": "RefundNotAvailable",
  "inputs": []
 },
 {
  "type": "error",
  "name": "SafeERC20FailedOperation",
  "inputs": [
   {
    "name": "token",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "SoldOut",
  "inputs": []
 },
 {
  "type": "error",
  "name": "WalletLimit",
  "inputs": []
 },
 {
  "type": "error",
  "name": "WrongPayment",
  "inputs": []
 }
];

export const TICK_TOKEN_ABI = [
 {
  "type": "function",
  "name": "balanceOf",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "decimals",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint8",
    "internalType": "uint8"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "symbol",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "string",
    "internalType": "string"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "transfersEnabled",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "view"
 }
];
