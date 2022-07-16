import 'colors';
import 'dotenv/config';
import BN from 'bignumber.js';
import { AbiItem } from 'web3-utils';
import { Table } from 'console-table-printer';
import { Contract } from 'web3-eth-contract';

import quoter from '../abi/quoter.json';
import ADDRESS from '../config/address.json';
import { FIXED, NETWORK } from '../config';
import { Token, CallData, MultiCall } from './types';
import { web3, dexNames, erc20, swapRouter, flashSwap, multicall } from './global';

const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY).address;

export const stripAnsiCodes = (str: string) => str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

export const toPrintable = (amount: BN, decimal: number, fixed: number) => {
    return amount.isFinite()
        ? amount.div(new BN(10).pow(decimal)).toFixed(fixed)
        : 'N/A';
}

export const getPriceUSD = async (token: Token) => {
    if (!ADDRESS[NETWORK]['chainlink'][token.symbol]) return null;
    const quote = new web3.eth.Contract(quoter as AbiItem[], ADDRESS[NETWORK]['chainlink'][token.symbol]);
    const priceString: string = await quote.methods.latestAnswer().call();
    return new BN(priceString);
}

export const getAllQuotes = async (amountIn: BN, tokenIn: Token, tokenOut: Token): Promise<[string, BN[]]> => {
    if (!amountIn.isFinite()) return ['N/A', new Array(swapRouter.length).fill(new BN(-Infinity))];

    const input = amountIn.toFixed();
    const calldata: CallData[] = swapRouter.map(router => [
        router.options.address,
        router.methods.getAmountsOut(input, [tokenIn.address, tokenOut.address]).encodeABI()
    ]);

    const result: MultiCall = await multicall.methods.tryBlockAndAggregate(false, calldata).call();
    const blockNumber = result.blockNumber;
    const blockHash = result.blockHash;
    const quotes: BN[] = result.returnData.map(res => res.success ? new BN(web3.eth.abi.decodeParameter('uint256[]', res.returnData)[1] as string) : new BN(-Infinity));

    return [blockNumber, quotes];
}

export const callFlashSwap = async (inputAmount: BN[], tokenPath: Token[], swapPath: Contract[]) => {
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

export const run = async (initial: BN, tokens: Token[]) => {
    console.log(tokens.map(token => token.symbol.yellow).join(' -> ') + ' -> ' + tokens[0].symbol.yellow);

    const table = new Table();

    const maxAmountOut: BN[] = [initial,];
    const amountOut: BN[][] = [];
    const swapPath: Contract[] = [];
    const blockNumber: string[] = [];
    const fee = initial.times(3).idiv(997).plus(1);
    const tokenPriceUSD = await getPriceUSD(tokens[0]);

    for (let i = 0; i < tokens.length; i++) {
        let next = (i + 1) % tokens.length;

        [blockNumber[i], amountOut[i]] = await getAllQuotes(maxAmountOut[i], tokens[i], tokens[next]);
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

        const row = { 'Input Token': `${amountIn} ${tokens[i].symbol}` };
        dexNames.forEach((dexName, key) => { row[dexName] = `${amountPrint[key]} ${tokens[next].symbol}` });
        table.addRow(row);
    }

    table.printTable();

    if (blockNumber[0] === blockNumber[tokens.length]) {
        console.log('BlockNumber Conflict! Try again.');
        return {
            profit: new BN(-Infinity),
            profitUSD: null,
            table: null,
            callSwapParams: null
        }
    }
    const block = await web3.eth.getBlock(blockNumber[0]);
    console.log(
        'BlockNumber:', blockNumber[0].yellow,
        '\tGas Limit:', block.gasLimit,
        '\tTimeStamp:', block.timestamp,
        `(${new Date(block.timestamp as number * 1000).toUTCString()})`
    )

    const profit = maxAmountOut[tokens.length].minus(maxAmountOut[0]).minus(fee);
    const profitPrint = toPrintable(profit, tokens[0].decimals, FIXED);
    const initialPrint = toPrintable(initial, tokens[0].decimals, FIXED);
    const profitUSD = tokenPriceUSD ? toPrintable(tokenPriceUSD.times(profit), tokens[0].decimals + 8, FIXED) : 'N/A';
    console.log(
        'Input:', initialPrint.yellow, tokens[0].symbol,
        '\tEstimate profit:', profit.gt(0) ? profitPrint.green : profitPrint.red, tokens[0].symbol,
        `($ ${profitUSD})`,
        '\n'
    );

    return {
        profit,
        profitPrint,
        initialPrint,
        profitUSD,
        table,
        block,
        callSwapParams: { maxAmountOut, tokens, swapPath }
    }
}