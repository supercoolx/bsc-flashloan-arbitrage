import 'dotenv/config';
import fs from 'fs';
import BN from 'bignumber.js';

import { run, stripAnsiCodes } from './utils';
import { Token } from './utils/types';

import { NETWORK } from './config';
import TOKEN from './config/tokenshort.json';

const runBot = async (tokens: Token[]) => {
    const initial = new BN(1).times(new BN(10).pow(tokens[0].decimals));
    const res = await run(initial, tokens);

    if (res.profit.lte(0)) return ;
    let output: string = "";
    output += tokens.map(token => token.symbol).join(' -> ') + ' -> ' + tokens[0].symbol + '\n';
    output += `BlockNumber: ${res.block.number}\tGas Limit: ${res.block.gasLimit}\tTimeStamp: ${res.block.timestamp} (${new Date(res.block.timestamp as number * 1000).toUTCString()})\n`;
    output += `Input: ${res.initialPrint} ${tokens[0].symbol}\tEstimate profit: ${res.profitPrint} ${tokens[0].symbol} ($ ${res.profitUSD})\n`;
    output += stripAnsiCodes(res.table.render()) + '\n\n';

    const date = new Date();
    const fileName = `./logs/${date.getFullYear()}-${date.getMonth()}-${date.getDay()}.log`;
    fs.appendFile(fileName, output, () => {});
}

const main = async () => {
    let args = process.argv.slice(2).map(arg => arg.toUpperCase());
    if (args.length < 2) return console.log('Please input at least two token.');

    args.forEach(arg => {
        if (arg === '*' ||  TOKEN[NETWORK][arg]) return;
        console.log(`There's no ${arg} token.`.red);
        process.exit();
    });

    const getTokens = async (symbols: string[], index: number) => {
        if (!symbols[index]) return await runBot(symbols.map(symbol => TOKEN[NETWORK][symbol]));
        if (symbols[index] === '*') {
            for (let tokenSymbol in TOKEN[NETWORK]) {
                await getTokens([...symbols.slice(0, index), tokenSymbol, ...symbols.slice(index + 1)], index + 1);
            }
        }
        else await getTokens(symbols, index + 1);
    }

    await getTokens(args, 0);
}

main();
