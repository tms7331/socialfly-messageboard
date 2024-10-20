"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LitNetwork, LIT_RPC } from "@lit-protocol/constants";
import { LitActionResource } from "@lit-protocol/auth-helpers";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import {
    IndexService,
    decodeOnChainData,
    DataLocationOnChain,
    SchemaItem
} from "@ethsign/sp-sdk";

import {
    createSiweMessage,
    generateAuthSig,
    LitAbility,
    LitAccessControlConditionResource,
} from "@lit-protocol/auth-helpers";
import { ethers } from 'ethers';

interface Message {
    address: string;
    location: string;
    photo: string;
    timestamp: number;
    content: string;
}

const schemaId_location = "onchain_evm_84532_0x38b";
const indexing = "socialfly_app_0";


// const accessControlConditions = [
//     {
//         contractAddress: "0x4d2C7E3F9e498EdaCbAa99C613C1b89b9B218877",
//         standardContractType: "",
//         chain: "sepolia",
//         method: "getApprovalOk",
//         parameters: [":userAddress", "0x4d2C7E3F9e498EdaCbAa99C613C1b89b9B218877", "abcdefg"],
//         //functionAbi:
//         //{
//         //  "type": "function",
//         //  "name": "getApprovalOk",
//         //  "stateMutability": "view",
//         //  "inputs": [{ "name": "caller", "type": "address", "internalType": "address" },
//         //  { "name": "hardcodedAddress", "type": "address", "internalType": "address" },
//         //  { "name": "ipfsCid", "type": "string", "internalType": "string" }],
//         //  "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }]
//         //},
//         returnValueTest: {
//             comparator: '=',
//             value: 'true'
//         },
//     },
// ];

const accessControlConditions = [
    {
        contractAddress: '',
        standardContractType: '',
        chain: 'sepolia',
        method: 'eth_getBalance',
        parameters: [
            ':userAddress',
            'latest'
        ],
        returnValueTest: {
            comparator: '>=',
            value: '0'
        }
    }
]

const code = `(async () => {
  const resp = await Lit.Actions.decryptAndCombine({
    accessControlConditions,
    ciphertext,
    dataToEncryptHash,
    authSig: null,
    chain: 'ethereum',
  });
  Lit.Actions.setResponse({ response: resp });
})();`

export default function MessageBoard() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [address, setAddress] = useState('');
    const [location, setLocation] = useState('');
    const [photo, setPhoto] = useState('');
    const [content, setContent] = useState('');
    const [timestamp, setTimestamp] = useState(Date.now());

    const handleSubmit = async () => {
        console.log("handleSubmit...");
        const { error } = await supabase.from('posts').insert([
            {
                address, location, photo, content, timestamp
            },
        ]);

        if (error) {
            console.error('Error sending message:', error);
        } else {
            setMessages([...messages, { address, location, photo, content, timestamp }]);
        }

    };


    const initialize = async () => {
        // First - get our address...
        if (typeof window !== 'undefined' && window.ethereum) {
            try {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();
                const address = await signer.getAddress();
                console.log("account:", address);
                setAddress(address);

                // Listen for account changes
                window.ethereum.on('accountsChanged', (accounts) => {
                    setAddress(accounts[0]);
                });
            } catch (error) {
                console.error('User denied account access or error occurred:', error);
            }
        } else {
            console.error('MetaMask is not installed. Please install it to use this app.');
        }

        // Second - get data from sign
        console.log("runQuery...");
        const indexingClient = new IndexService("testnet");
        // const att = await indexingClient.queryAttestation(`onchain_evm_${chainId}_${attId}`);
        //const schemaId_full = "onchain_evm_84532_0x300";
        // const res0 = await indexingClient.querySchema(schemaId_location);
        // console.log(res0);
        const res = await indexingClient.queryAttestationList({
            id: "",
            schemaId: schemaId_location,
            attester: "0xC52178a1b28AbF7734b259c27956acBFd67d4636",
            page: 1,
            mode: "onchain",
            indexingValue: indexing,
        });

        // Finally - decrypt data and set our user data
        console.log(res);
        const items = res!.rows;
        // Should only be one, should we assert?
        for (const item of items) {
            console.log(item);
            const dec = decodeOnChainData(item.data, DataLocationOnChain.ONCHAIN, item.schema.data as SchemaItem[]);
            console.log(dec)

            // Now do lit decode...
            await fetchData(dec.ciphertext, dec.dataToEncryptHash);



        }
    }


    useEffect(() => {
        initialize();
    }, []);

    const client = new LitNodeClient({
        litNetwork: LitNetwork.DatilDev,
        debug: true
    });


    const fetchData = async (ciphertext: string, dataToEncryptHash: string) => {

        await client.connect();
        // NEXT_PUBLIC_PK
        const PK = process.env.NEXT_PUBLIC_PK;
        // const wallet = await genWallet();

        const ethersWallet = new ethers.Wallet(
            PK, // Make sure to set this in your .env file
            new ethers.providers.JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE)
        );

        // const ciphertext = "pzmZ4DmdRp35cUKO6Cg2xfFWiyXalB5rYzO847Tk/KKYLHVIwQlXy2XgjTzktVg0IHXd9Lg5MWatwmhmqmkEKHfmuwjk+EA3oAg6m4auamsgej88MqYTq5qygvnvDwSausmmk2bqs/bo/TaAYf/og9EC";
        // const dataToEncryptHash = "64ec88ca00b268e5ba1a35678a1b5316d212f4f366b2477232534a8aeca37f3c";


        ///////// session sigs...

        const sessionSigs = await client.getSessionSigs({
            chain: "ethereum",
            expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 minutes
            resourceAbilityRequests: [
                {
                    resource: new LitActionResource('*'),
                    ability: LitAbility.LitActionExecution,
                },
                {
                    resource: new LitAccessControlConditionResource(
                        await LitAccessControlConditionResource.generateResourceString(
                            accessControlConditions,
                            dataToEncryptHash
                        )
                    ),
                    ability: LitAbility.AccessControlConditionDecryption,
                },
            ],
            authNeededCallback: async ({
                uri,
                expiration,
                resourceAbilityRequests,
            }) => {
                const toSign = await createSiweMessage({
                    uri,
                    expiration,
                    resources: resourceAbilityRequests,
                    walletAddress: ethersWallet.address,
                    nonce: await client.getLatestBlockhash(),
                    litNodeClient: client,
                });

                return await generateAuthSig({
                    signer: ethersWallet,
                    toSign,
                });
            },
        });

        const res = await client.executeJs({
            code,
            sessionSigs: sessionSigs, // your session
            jsParams: {
                accessControlConditions,
                ciphertext,
                dataToEncryptHash
            }
        });
        console.log("decrypted content sent from lit action:", res);
        setLocation(res.response as string);
        await client.disconnect();
    }


    // Fetch messages from Supabase
    useEffect(() => {
        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from('posts')
                .select('*')
                .order('timestamp', { ascending: true });

            if (error) {
                console.error('Error fetching posts:', error.message);
                return null;
            }
            else {
                setMessages(data as Message[])
            }

            // const { data, error } = await supabase
            //     .from('posts')
            //     .select('content, created_at, users(username, profile_image_url)')
            //     .order('created_at', { ascending: false });

            // if (error) {
            //     console.error('Error fetching messages:', error);
            // } else {
            //     setMessages(data as Message[]);
            // }
        };

        fetchMessages();
    }, []);

    return (
        <div style={{ padding: '20px' }}>


            <style jsx>{`
                h1 {
                    font-size: 2.5rem;
                    color: #333;
                    text-align: center;
                    margin-bottom: 30px;
                    font-family: 'Arial', sans-serif;
                }
                .message-board {
                    max-width: 800px;
                    margin: 0 auto;
                    background-color: #f9f9f9;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    padding: 20px;
                }
                .post-form {
                    margin-bottom: 30px;
                }
                .post-form textarea {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    resize: vertical;
                    min-height: 100px;
                }
                .post-form button {
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    text-align: center;
                    text-decoration: none;
                    display: inline-block;
                    font-size: 16px;
                    margin-top: 10px;
                    cursor: pointer;
                    border-radius: 4px;
                    transition: background-color 0.3s;
                }
                .post-form button:hover {
                    background-color: #45a049;
                }
                .message-list {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .message {
                    background-color: white;
                    border-radius: 8px;
                    padding: 15px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }
                .message-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .message-header img {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    margin-right: 10px;
                    object-fit: cover;
                }
                .message-header strong {
                    font-size: 0.9rem;
                    color: #555;
                }
                .message-content {
                    font-size: 1rem;
                    color: #333;
                    line-height: 1.4;
                }
            `}</style>

            <div className="flex flex-col items-center mb-5 p-4 border rounded-md shadow-md w-full max-w-md mx-auto bg-white">
                <h1 className="text-2xl font-bold text-blue-600 mb-5">Socialfly Message Board</h1>
                <div className="w-full mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">Post Content:</label>
                    <textarea
                        className="w-full p-2 border rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        required
                    />
                </div>
                <div className="w-full">
                    <button
                        onClick={handleSubmit}
                        className="w-full py-2 px-4 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600 transition duration-300"
                    >
                        Add Post
                    </button>
                </div>
            </div>




            <div>
                {messages.map((message, index) => (
                    <div key={index} style={{ borderBottom: '1px solid #ccc', padding: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <img
                                src={message.photo || '/default-avatar.png'}
                                alt="profile"
                                style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '10px' }}
                            />
                            <strong>{message.address} LOCATED AT: {message.location}</strong>
                        </div>
                        <p>{message.content}</p>
                    </div>
                ))}
            </div>

        </div>
    );
}

