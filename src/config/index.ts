import { Network } from "../utils/types";

export const NETWORK: Network = (process.env.NETWORK.trim() || 'mainnet') as Network;
export const FIXED = 4;
export const RPC_URL = {
    'mainnet': 'https://bsc-dataseed.binance.org/',
    'testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    'localhost': 'http://localhost:8545'
}