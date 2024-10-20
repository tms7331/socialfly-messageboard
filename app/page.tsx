'use client';
import { useState } from 'react';
import React from 'react';
import {
  WagmiConfig,
  createConfig,
  configureChains,
  useAccount,
  useConnect,
  useSendTransaction,
} from 'wagmi';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { Chain } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0x4d2C7E3F9e498EdaCbAa99C613C1b89b9B218877";

// Manually define the Sepolia chain
const sepolia: Chain = {
  id: 11155111,
  name: 'Sepolia',
  network: 'sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Sepolia Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.sepolia.org'],
    },
    public: {
      http: ['https://rpc.sepolia.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Etherscan',
      url: 'https://sepolia.etherscan.io',
    },
  },
  testnet: true,
};

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [sepolia],
  [publicProvider()]
);

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [new MetaMaskConnector({ chains })],
  publicClient,
  webSocketPublicClient,
});


function ConnectWallet() {
  const { connect } = useConnect({
    connector: new MetaMaskConnector({ chains }),
  });

  const { address, isConnected } = useAccount();

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      {isConnected ? (
        <div>Connected as {address}</div>
      ) : (
        <button onClick={() => connect()}>Connect Wallet to join Socialfly Messageboard</button>
      )}
    </div>
  );
}

function SendTransaction() {
  const { address, isConnected } = useAccount();

  const { data, isLoading, isSuccess, sendTransaction } = useSendTransaction();

  const handleSendTransaction = () => {
    sendTransaction({
      to: '0x54752966104e8a6a5E45e25008f9327956bC1092',
      value: BigInt(100),
    });
  };

  const handleContractInteraction = async () => {
    if (!window.ethereum) {
      alert('MetaMask is not installed');
      return;
    }

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = await provider.getSigner();

      const contractABI = [
        "function setApproval(string ipfsCid, bool value) public",
      ];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
      const mbCid = "QmWMcWqHi2xid63s6kbsSDgmBsQtGua5auepKshP84VbGT";
      const tx = await contract.setApproval(mbCid, true);

      console.log('Transaction hash:', tx.hash);
      window.location.href = '/messageboard';
    } catch (error) {
      console.error('Transaction error:', error);
    }
  };

  if (!isConnected) return null;

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <button onClick={handleContractInteraction} disabled={isLoading}>
        Authorize Socialfly Messageboard
      </button>
      {isLoading && <div>Sending transaction...</div>}
      {isSuccess && (
        <div>
          Transaction sent!{' '}
          <a
            href={`https://sepolia.etherscan.io/tx/${data?.hash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Etherscan
          </a>
        </div>
      )}
    </div>
  );
}


export default function Home() {



  // <div style={{ textAlign: 'center', marginTop: '50px' }}>
  //   <button onClick={handleJoinApp}>Join Socialfly Messageboard</button>
  //   {message && <h1>{message}</h1>}
  // </div>


  return (
    <WagmiConfig config={wagmiConfig}>
      <ConnectWallet />
      <SendTransaction />
    </WagmiConfig>

  );
}
