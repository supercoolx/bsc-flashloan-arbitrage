export type Token = {
    name: string
    symbol: string
    address: string
    decimals: number
}

export type Network = "mainnet" | "testnet" | "localhost";

export type AddressType = {
    [key in Network]: {
        [key: string]: string
    }
}

export type CallData = [string, string]

export type MultiCall = {
    blockNumber: string
    blockHash: string
    returnData: {
        success: boolean
        returnData: string
    }[]
}