import 'dotenv/config';
import Web3 from 'web3';
import axios from 'axios';
import BN from 'bignumber.js';
import inquirer from 'inquirer';
import { Table } from 'console-table-printer';

import { AbiItem } from 'web3-utils';
import { Token, CallData } from './utils/types';

import TOKEN from './config/tokens.json';
import ADDRESS from './config/address.json';

import { toPrintable } from './utils';
import { NETWORK, FIXED, RPC_URL } from './config';

import IERC20 from './abi/erc20.json';
import IPancakeFlashSwap from './abi/PancakeFlashSwap.json';

const web3 = new Web3(RPC_URL[NETWORK]);
const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY).address;

const flashSwap = new web3.eth.Contract(IPancakeFlashSwap as AbiItem[], ADDRESS[NETWORK]['flashSwap']);
const erc20 = new web3.eth.Contract(IERC20 as AbiItem[], '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE');

const getQuote = async (amountIn: BN, tokenIn: Token, tokenOut: Token): Promise<[string, BN, CallData[]]> => {
    const res = await axios.get('https://api.1inch.exchange/v4.0/56/swap', {
        params: {
            fromTokenAddress: tokenIn.address,
            toTokenAddress: tokenOut.address,
            amount: amountIn.toFixed(),
            fromAddress: flashSwap.options.address,
            slippage: 1,
            disableEstimate: true
        }
    })
    .catch(err => {
        console.log(err.message);
        process.exit();
    });
    
    const dexName: string = res.data.protocols[0][0][0].name;
    const quote: BN = new BN(res.data.toTokenAmount);
    const callData: CallData[] = [
        [
            tokenIn.address,
            erc20.methods.approve(
                res.data.tx.to,
                res.data.fromTokenAmount
            ).encodeABI()
        ],
        [res.data.tx.to, res.data.tx.data]
    ];

    return [dexName, quote, callData];
}

const callFlashSwap = async (loanToken: Token, loanAmount: BN, callData: CallData[]) => {
    const data = flashSwap.methods.flashloan(loanToken.address, loanAmount.toFixed(), callData).encodeABI();
    const tx = {
        from: account,
        to: flashSwap.options.address,
        gas: 1000000,
        data: data
    };
    const signedTx = await web3.eth.accounts.signTransaction(tx, process.env.PRIVATE_KEY);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log(receipt.transactionHash);
}

const run = async (initial: BN, tokens: Token[]) => {
    const table = new Table();

    const callData: CallData[] = [];
    const amountOut: BN[] = [initial,];
    const fee = initial.times(3).div(997).plus(1);

    for (let i = 0; i < tokens.length; i++) {
        let next = (i + 1) % tokens.length;
        let dexName: string;
        let data: CallData[];

        [dexName, amountOut[i + 1], data] = await getQuote(amountOut[i], tokens[i], tokens[next]);

        callData.push(...data);

        let amountInPrint: string = toPrintable(amountOut[i], tokens[i].decimals, FIXED).yellow;
        let amountOutPrint: string = toPrintable(amountOut[i + 1], tokens[next].decimals, FIXED).yellow;

        table.addRow({
            'Input Token': `${amountInPrint} ${tokens[i].symbol}`,
            [dexName]: `${amountOutPrint} ${tokens[next].symbol}`,
        });
    }

    table.printTable();

    const profit = amountOut[tokens.length].minus(amountOut[0]).minus(fee);
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
        response.isExe === 'yes' && await callFlashSwap(tokens[0], initial, callData);
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
