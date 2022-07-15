import BN from 'bignumber.js';
import inquirer from 'inquirer';

import { Token } from './utils/types';
import TOKEN from './config/tokens.json';

import { NETWORK } from './config';
import { run, callFlashSwap } from './utils';

const runBot = async (initial: BN, tokens: Token[]) => {
    const res = await run(initial, tokens);

    if (res.profit.gt(0)) {
        let response = await inquirer.prompt([{
            type: 'input',
            name: 'isExe',
            message: `Are you sure execute this trade? (yes/no)`
        }]);
        response.isExe === 'yes' && await callFlashSwap(
            res.callSwapParams.maxAmountOut,
            res.callSwapParams.tokens,
            res.callSwapParams.swapPath
        );
    }
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
        let response = await inquirer.prompt([{
            type: 'input',
            name: 'input',
            message: `Please input ${tokens[0].symbol} amount:`
        }]);
        let input = parseFloat(response.input);
        if (isNaN(input) || input <= 0) continue;

        let initial = new BN(input).times(new BN(10).pow(tokens[0].decimals));
        await runBot(initial, tokens);
    }
}

main();
