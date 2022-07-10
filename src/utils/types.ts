export type Token = {
    name: string
    symbol: string
    address: string
    decimals: number
}

export type Network = "mainnet" | "testnet";

export type AddressType = {
    [key in Network]: {
        [key: string]: string
    }
}

export type CallData = [string, string]