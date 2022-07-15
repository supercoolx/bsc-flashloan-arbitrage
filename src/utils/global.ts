import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';

import ADDRESS from '../config/address.json';

import { NETWORK, RPC_URL } from '../config';

import IERC20 from '../abi/erc20.json';
import IRouter from '../abi/router.json';
import IMulticall from '../abi/multicall.json';
import IPancakeFlashSwap from '../abi/PancakeFlashSwap.json';

export const web3 = new Web3(RPC_URL[NETWORK]);

export const dexNames: string[] = Object.keys(ADDRESS[NETWORK]['dex']);
export const swapRouter: Contract[] = dexNames.map(dexName => new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['dex'][dexName]));

export const erc20 = new web3.eth.Contract(IERC20 as AbiItem[], '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE');
export const multicall = new web3.eth.Contract(IMulticall as AbiItem[], ADDRESS[NETWORK]['util']['multicall']);
export const flashSwap = new web3.eth.Contract(IPancakeFlashSwap as AbiItem[], ADDRESS[NETWORK]['util']['flashSwap']);