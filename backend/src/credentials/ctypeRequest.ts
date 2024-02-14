import * as Kilt from '@kiltprotocol/sdk-js'

import { CTYPE_HASH, REQUIRED_PROPERTIES, TRUSTED_ATTESTERS } from '../config'

// Here you can set which type of credential (cType) your dApp will request users to login.
// You can change it by importing a different one.
// Establish which cTypes our dApp accepts and which attesters we trust:

const trustedAttesters = TRUSTED_ATTESTERS.split(',') as Kilt.DidUri[]
const requiredProperties = REQUIRED_PROPERTIES.split(',')

/**
 * Credential for users to configure default as SocialKYC Email Credential
 */
export const cTypeToRequest: Kilt.IRequestCredentialContent = {
  cTypes: [
    {
      cTypeHash: CTYPE_HASH as `0x${string}`,
      trustedAttesters,
      requiredProperties
    }
  ]
}