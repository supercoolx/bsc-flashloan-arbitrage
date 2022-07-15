import 'dotenv/config';
import fs from 'fs';
import BN from 'bignumber.js';

import { run } from './utils';
import { Token } from './utils/types';

import { NETWORK } from './config';
import TOKEN from './config/tokenshort.json';

var output = [];

const runBot = async (tokens: Token[]) => {
    const initial = new BN(1).times(new BN(10).pow(tokens[0].decimals));
    const res = await run(initial, tokens);

    output.push({
        tokens: tokens.map(token => token.symbol),
        profit: res.profit.toFixed()
    });
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

    fs.writeFileSync('output.json', JSON.stringify(output, null, '\t'));
}

main();
