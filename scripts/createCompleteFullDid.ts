import * as Kilt from '@kiltprotocol/sdk-js';
import { useStoreTxSignCallback } from '../backend/src/utils/callBacks';
import { generateKeypairs } from '../backend/src/utils/attester/generateKeyPairs';

export default async function createCompleteFullDid(
    submitterAccount: Kilt.KiltKeyringPair,
    {
        authentication,
        encryption,
        attestation,
        delegation
    }: {
        authentication: Kilt.NewDidVerificationKey;
        encryption: Kilt.NewDidEncryptionKey;
        attestation: Kilt.NewDidVerificationKey;
        delegation: Kilt.NewDidVerificationKey;
    },
    signCallback?: Kilt.SignExtrinsicCallback
): Promise<Kilt.DidDocument> {
    const api = Kilt.ConfigService.get('api');

    // const fullDidCreationTx = await Kilt.Did.getStoreTx(
    //     {
    //         authentication: [authentication],
    //         keyAgreement: [encryption],
    //         assertionMethod: [attestation],
    //         capabilityDelegation: [delegation],
    //         // Example service.
    //         service: [
    //             {
    //                 id: '#my-dApp',
    //                 type: ['service-type'],
    //                 serviceEndpoint: [process.env.ORIGIN || "https://www.example.com"]
    //             }
    //         ]
    //     },
    //     submitterAccount.address,
    //     signCallback
    // );

    const fullDidCreationTx = await useStoreTxSignCallback(submitterAccount.address);

    await Kilt.Blockchain.signAndSubmitTx(fullDidCreationTx, submitterAccount);

    // The new information is fetched from the blockchain and returned.
    const fullDid = Kilt.Did.getFullDidUriFromKey(authentication);
    const encodedUpdatedDidDetails = await api.call.did.query(
        Kilt.Did.toChain(fullDid)
    );
    return Kilt.Did.linkedInfoFromChain(encodedUpdatedDidDetails).document;
}

export function createCompleFullDIDfromMnemonic(mnemonic: string) {

}