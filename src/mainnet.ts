import 'dotenv/config';
import Web3 from 'web3';
import BN from 'bignumber.js';
import inquirer from 'inquirer';
import { Table } from 'console-table-printer';

import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';
import { Token, Network, CallData } from './utils/types';

import TOKEN from './config/tokens.json';
import ADDRESS from './config/address.json';

import { toPrintable } from './utils';
import { NETWORK, FIXED, RPC_URL } from './config';

import IMulticall from './abi/multicall.json';
import IERC20 from './abi/erc20.json';
import IRouter from './abi/router.json';
import IPancakeFlashSwap from './abi/PancakeFlashSwap.json';

const web3 = new Web3(RPC_URL[NETWORK]);
const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY).address;

const multicall = new web3.eth.Contract(IMulticall as AbiItem[], ADDRESS[NETWORK]['multicall']);
const flashSwap = new web3.eth.Contract(IPancakeFlashSwap as AbiItem[], ADDRESS[NETWORK]['flashSwap']);
const erc20 = new web3.eth.Contract(IERC20 as AbiItem[], '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE');

const swapRouter: Contract[] = [
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['pancakeswap']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['sushiswap']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['apeswap']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['babyswap']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['biswap']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['mdex']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['julswap']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['waultswap']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['bakeryswap']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['jetswap']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['cheeseswap']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['elkdex']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['pantherswap']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['cafeswap']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['radioshack']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['hyperswap']),
    new web3.eth.Contract(IRouter as AbiItem[], ADDRESS[NETWORK]['bscswap']),
];

const getAllQuotes = async (amountIn: BN, tokenIn: Token, tokenOut: Token) => {
    if (!amountIn.isFinite()) return new Array(swapRouter.length).fill(new BN(-Infinity));
    
    const input = amountIn.toFixed();
    const calldata = swapRouter.map(router => [
        router.options.address,
        router.methods.getAmountsOut(input, [tokenIn.address, tokenOut.address]).encodeABI()
    ]);

    const results: string[] = await multicall.methods.multicall(calldata).call();
    const quotes: BN[] = results.map(result => {
        try {
            let quote = new BN(web3.eth.abi.decodeParameter('uint256[]', result)[1] as any);
            return quote;
        } catch (err) {
            return new BN(-Infinity);
        }
    });

    return quotes;
}

const callFlashSwap = async (inputAmount: BN[], tokenPath: Token[], swapPath: Contract[]) => {
    if (swapPath.length !== tokenPath.length || swapPath.length !== inputAmount.length - 1) return console.log('Invalid swap path.');
    
    const deadline = ~~(Date.now() / 1000) + 3600 * 24;
    const callData: CallData[] = []
    swapPath.forEach((swap, i) => {
        callData.push([
            tokenPath[i].address,
            erc20.methods.approve(
                swap.options.address,
                inputAmount[i].toFixed()
            ).encodeABI()
        ]);
        callData.push([
            swap.options.address,
            swap.methods.swapExactTokensForTokens(
                inputAmount[i].toFixed(),
                inputAmount[i + 1].toFixed(),
                [tokenPath[i].address, tokenPath[(i + 1) % tokenPath.length].address],
                flashSwap.options.address,
                deadline
            ).encodeABI()
        ]);
    });

    const data = flashSwap.methods.flashloan(tokenPath[0].address, inputAmount[0].toFixed(), callData).encodeABI();
    const tx = {
        from: account,
        to: flashSwap.options.address,
        gas: 500000,
        data: data
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, process.env.PRIVATE_KEY);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log(receipt.transactionHash);
}

const run = async (initial: BN, tokens: Token[]) => {
    const table = new Table();

    const maxAmountOut: BN[] = [initial,];
    const amountOut: BN[][] = [];
    const swapPath: Contract[] = [];
    const fee = initial.times(3).div(997).plus(1);

    for (let i = 0; i < tokens.length; i++) {
        let next = (i + 1) % tokens.length;

        amountOut[i] = await getAllQuotes(maxAmountOut[i], tokens[i], tokens[next]);
        maxAmountOut[i + 1] = BN.max(...amountOut[i]);
        let amountIn: string = toPrintable(maxAmountOut[i], tokens[i].decimals, FIXED);

        let amountPrint: string[] = [];
        amountOut[i].forEach((out, key) => {
            let print = toPrintable(out, tokens[next].decimals, FIXED);
            if (maxAmountOut[i + 1].eq(out)) {
                amountPrint.push(print.green);
                swapPath.push(swapRouter[key]);
            }
            else amountPrint.push(print.yellow);
        });

        table.addRow({
            'Input Token': `${amountIn} ${tokens[i].symbol}`,
            'PancakeSwap': `${amountPrint[0]} ${tokens[next].symbol}`,
            'SushiSwap': `${amountPrint[1]} ${tokens[next].symbol}`,
            'ApeSwap': `${amountPrint[2]} ${tokens[next].symbol}`,
            'BabySwap': `${amountPrint[3]} ${tokens[next].symbol}`,
            'BiSwap': `${amountPrint[4]} ${tokens[next].symbol}`,
            'MDEX': `${amountPrint[5]} ${tokens[next].symbol}`,
            'JulSwap': `${amountPrint[6]} ${tokens[next].symbol}`,
            'WaultSwap': `${amountPrint[7]} ${tokens[next].symbol}`,
            'BakerySwap': `${amountPrint[8]} ${tokens[next].symbol}`,
            'JetSwap': `${amountPrint[9]} ${tokens[next].symbol}`,
            'CheeseSwap': `${amountPrint[10]} ${tokens[next].symbol}`,
            'ElkDex': `${amountPrint[11]} ${tokens[next].symbol}`,
            'PantherSwap': `${amountPrint[12]} ${tokens[next].symbol}`,
            'CafeSwap': `${amountPrint[13]} ${tokens[next].symbol}`,
            'RadioShack': `${amountPrint[14]} ${tokens[next].symbol}`,
            'HyperSwap': `${amountPrint[15]} ${tokens[next].symbol}`,
            'BSCSwap': `${amountPrint[16]} ${tokens[next].symbol}`,
        });
    }

    table.printTable();

    const profit = maxAmountOut[tokens.length].minus(maxAmountOut[0]).minus(fee);
    console.log(
        'Input:',
        toPrintable(initial, tokens[0].decimals, FIXED).yellow,
        tokens[0].symbol,
        '\tEstimate profit:',
        profit.gt(0) ?
            toPrintable(profit, tokens[0].decimals, FIXED).green :
            toPrintable(profit, tokens[0].decimals, FIXED).red,
        tokens[0].symbol
    );

    if (profit.gt(0)) {
        let response = await inquirer.prompt([{
            type: 'input',
            name: 'isExe',
            message: `Are you sure execute this trade? (yes/no)`
        }]);
        response.isExe === 'yes' && await callFlashSwap(maxAmountOut, tokens, swapPath);
    }

    return [profit, table];
}

const main = async () => {
    let args = process.argv.slice(2);
    if (args.length < 2) return console.log('Please input at least two token.');

    const tokens: Token[] = [];

    args.forEach(arg => {
        let symbol = arg.toUpperCase();
        if (!TOKEN[NETWORK][symbol]) {
            console.log(`There\'s no ${symbol} token.`);
            process.exit();
        }
        tokens.push(TOKEN[NETWORK][symbol]);
    });

    
    while (true) {
        console.log();
        let response = await inquirer.prompt([{
            type: 'input',
            name: 'input',
            message: `Please input ${tokens[0].symbol} amount:`
        }]);
        let input = parseFloat(response.input);
        if (isNaN(input) || input <= 0) continue;

        let initial = new BN(input).times(new BN(10).pow(tokens[0].decimals));
        await run(initial, tokens);
    }
}

main();
