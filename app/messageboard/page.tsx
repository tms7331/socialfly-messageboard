"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { LitNetwork, LIT_RPC } from "@lit-protocol/constants";
import { LitActionResource, createSiweMessageWithRecaps } from "@lit-protocol/auth-helpers";
import { LitNodeClient, encryptString } from "@lit-protocol/lit-node-client";
import {
    SignProtocolClient,
    SpMode,
    EvmChains,
    IndexService,
    decodeOnChainData,
    DataLocationOnChain,
    chainInfo,
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

interface User {
    id?: string;
    username: string;
    profile_image_url: string;
}

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
        console.log("handleSubmitB...");
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
        const schemaId_location = "onchain_evm_84532_0x38b";
        const indexing = "socialfly_app";
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
        setLocation("55,44");
        // Should only be one, should we assert?
        for (const item of items) {
            console.log(item);
            const dec = decodeOnChainData(item.data, DataLocationOnChain.ONCHAIN, item.schema.data as SchemaItem[]);
            console.log(dec)

            // Now do lit decode...
            await fetchData()

        }
    }


    useEffect(() => {
        initialize();
    }, []);

    const client = new LitNodeClient({
        litNetwork: LitNetwork.DatilDev,
        debug: true
    });


    const fetchData = async () => {

        await client.connect();
        // NEXT_PUBLIC_PK
        const PK = process.env.NEXT_PUBLIC_PK;
        // const wallet = await genWallet();

        const ethersWallet = new ethers.Wallet(
            PK, // Make sure to set this in your .env file
            new ethers.providers.JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE)
        );

        const ciphertext = "pzmZ4DmdRp35cUKO6Cg2xfFWiyXalB5rYzO847Tk/KKYLHVIwQlXy2XgjTzktVg0IHXd9Lg5MWatwmhmqmkEKHfmuwjk+EA3oAg6m4auamsgej88MqYTq5qygvnvDwSausmmk2bqs/bo/TaAYf/og9EC";
        const dataToEncryptHash = "64ec88ca00b268e5ba1a35678a1b5316d212f4f366b2477232534a8aeca37f3c";

        const chain = 'ethereum';
        const accessControlConditions = [
            {
                contractAddress: '',
                standardContractType: '',
                chain,
                method: 'eth_getBalance',
                parameters: [':userAddress', 'latest'],
                returnValueTest: {
                    comparator: '>=',
                    value: '0',
                },
            },
        ];

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
            <h1>Message Board</h1>
            <div style={{ marginBottom: '20px' }}>
                <div>
                    <label>Content:</label>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <button onClick={handleSubmit}>Add Post</button>
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

