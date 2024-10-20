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

      const contractAddress = '0xb5445C1Eba3Cf943EA73c36deeca1B7CD947f44D';
      const contractABI = [
        "function setApproval(string ipfsCid, bool value) public",
      ];
      const contract = new ethers.Contract(contractAddress, contractABI, signer);
      const tx = await contract.setApproval("abcd", true);

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
  const [message, setMessage] = useState('');

  const handleJoinApp = async () => {
    try {
      // const response = await fetch('/api/check-access');
      // const data = await response.json();
      const data = true;
      if (data) {
        window.location.href = '/messageboard';
      } else {
        setMessage('Access Denied');
      }
    } catch (error) {
      console.error('An error occurred:', error);
      setMessage('An error occurred. Please try again later.');
    }
  };


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
