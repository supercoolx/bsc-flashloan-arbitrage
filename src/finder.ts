import 'dotenv/config';
import fs from 'fs';
import Web3 from 'web3';
import axios from 'axios';
import BN from 'bignumber.js';
import { Table } from 'console-table-printer';

import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';
import { Token } from './utils/types';

import TOKEN from './config/tokens.json';
import ADDRESS from './config/address.json';

import { toPrintable } from './utils';
import { NETWORK, FIXED, RPC_URL } from './config';

import IMulticall from './abi/multicall.json';
import IRouter from './abi/router.json';

var tokenInfo;
var output = [];

const web3 = new Web3(RPC_URL[NETWORK]);

const multicall = new web3.eth.Contract(IMulticall as AbiItem[], ADDRESS[NETWORK]['multicall']);

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

const getTokenInfo = async () => {
    const tokens = Object.keys(TOKEN[NETWORK]).join(',');
    const res = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest', {
        headers: {
            'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_KEY
        },
        params: {
            symbol: tokens,
            convert: 'USD'
        }
    })
    .catch(err => {
        console.log(err.message);
        process.exit();
    });
    tokenInfo = res.data.data;
}

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

const run = async (tokens: Token[]) => {
    console.log(tokens.map(token => token.symbol.yellow).join(' -> ') + ' -> ' + tokens[0].symbol.yellow);

    const table = new Table();

    const initial = new BN(1).times(new BN(10).pow(tokens[0].decimals));
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
    const profitUSD = profit.isFinite() ? new BN(tokenInfo[tokens[0].symbol].quote.USD.price).times(profit).div(new BN(10).pow(tokens[0].decimals)).toFixed(FIXED) : 'N/A';
    console.log(
        'Input:',
        toPrintable(initial, tokens[0].decimals, FIXED).yellow,
        tokens[0].symbol,
        '\tEstimate profit:',
        profit.gt(0) ?
            toPrintable(profit, tokens[0].decimals, FIXED).green :
            toPrintable(profit, tokens[0].decimals, FIXED).red,
        tokens[0].symbol,
        `($ ${profitUSD})`
    );

    output.push({
        tokens: tokens.map(token => token.symbol),
        profitUSD: profitUSD
    });

    return [profit, table];
}

const main = async () => {
    await getTokenInfo();

    let args = process.argv.slice(2).map(arg => arg.toUpperCase());
    if (args.length < 2) return console.log('Please input at least two token.');

    args.forEach(arg => {
        if (arg === '*' ||  TOKEN[NETWORK][arg]) return;
        console.log(`There's no ${arg} token.`.red);
        process.exit();
    });

    const getTokens = async (symbols: string[], index: number) => {
        if (!symbols[index]) return await run(symbols.map(symbol => TOKEN[NETWORK][symbol]));
        if (symbols[index] === '*') {
            for (let tokenSymbol in TOKEN[NETWORK]) {
                await getTokens([...symbols.slice(0, index), tokenSymbol, ...symbols.slice(index + 1)], index + 1);
            }
        }
        else await getTokens(symbols, index + 1);
    }

    await getTokens(args, 0);

    output.sort((a, b) => parseFloat(a.profitUSD) - parseFloat(b.profitUSD));
    fs.writeFileSync('output.json', JSON.stringify(output));
}

main();
