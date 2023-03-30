import * as Kilt from '@kiltprotocol/sdk-js'
import { Response, Request, NextFunction, CookieOptions } from 'express'
import jwt from 'jsonwebtoken'

import { generateKeypairs } from '../utils/attester/generateKeyPairs'
import { getApi } from '../utils/connection'

// Define how the Session Values are packaged:
interface SessionValues {
  dAppName: string
  dAppEncryptionKeyUri: Kilt.DidResourceUri
  challenge: string
}

export async function generateSessionValues(
  didDocument: Kilt.DidDocument
): Promise<SessionValues> {
  console.log('generating session Values')
  // connects to the websocket of your, in '.env', specified blockchain
  await getApi()
  const dAppName = process.env.DAPP_NAME ?? 'Your dApp Name'

  // Build the EncryptionKeyUri so that the client can encrypt messages for us:
  const dAppEncryptionKeyUri =
    `${didDocument.uri}${didDocument.keyAgreement?.[0].id}` as Kilt.DidResourceUri

  if (typeof didDocument.keyAgreement === undefined) {
    throw new Error('This DID has no Key Agreement. Cannot encrypt like this.')
  }

  // Generate a challenge to ensure all messages we receive are fresh.
  // A UUID is a universally unique identifier, a 128-bit label. Here express as a string of a hexadecimal number.
  const challenge = Kilt.Utils.UUID.generate()

  const sessionValues = {
    dAppName: dAppName,
    dAppEncryptionKeyUri: dAppEncryptionKeyUri,
    challenge: challenge
  }

  console.log('sesssion Values just generated', sessionValues)

  return sessionValues
}

/**
 * Saving the session values as a JSON-Web-Token on a Cookie of the browser
 */
export async function generateJWT(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    // we use the DID-Document from the dApp fetched on server-start to generate our Session Values:
    const payload = await generateSessionValues(
      request.app.locals.dappDidDocument
    )
    const secretKey = process.env.JWT_ENCODER
    if (!secretKey) {
      throw new Error(
        "Define a value for 'JWT_ENCODER' on the '.env'-file first!"
      )
    }

    // Create a Json-Web-Token:
    const options = {
      expiresIn: '1d'
    }
    // default to algorithm: 'HS256',
    const token = jwt.sign(payload, secretKey, options)

    // Set cookie options (list of ingredients)
    const cookieOptions: CookieOptions = {
      // Indicates the number of seconds until the Cookie expires.
      maxAge: 60 * 60 * 24,
      // only send over HTTPS
      secure: true,
      // prevent cross-site request forgery attacks
      sameSite: 'strict',
      // restricts URL that can request the Cookie from the browser. '/' works for the entire domain.
      path: '/',
      // Forbids JavaScript from accessing the cookie
      httpOnly: true
    }

    // Set a Cookie in the header including the JWT and our options:
    // Using 'cookie-parser' deendency:
    response.cookie('sessionJWT', token, cookieOptions)

    console.log(
      'The JSON-Web-Token with Session Values generated by the backend is: \n',
      token
    )

    // send the Payload as plain text on the response, this facilitates the start of the extension session.
    response.status(200).send(payload)
  } catch (error) {
    // print the possible error on the frontend
    next(error)
    response
      .status(500)
      .send(`Could not set Cookie with session values. \n Error: ${error}.`)
  }
}

export async function verifySession(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  const secretKey = process.env.JWT_ENCODER
  if (!secretKey) {
    response
      .status(500)
      .send(
        `Could not find JWT-Secret-key; so it is not possible to verify session.`
      )
    throw new Error(
      "Define a value for 'JWT_ENCODER' on the '.env'-file first!"
    )
  }

  // read cookie from browser
  const sessionCookie = request.cookies.sessionJWT
  if (!sessionCookie) {
    response
      .status(401)
      .send(
        `Could not find Cookie with session values (as JWT). Log-in and try again.`
      )
    throw new Error('Cookie with Session JWT not found. Log-in and try again.')
  }

  // decode the JWT and verify if it was signed with our SecretKey

  let cookiePayloadServerSession: jwt.JwtPayload
  try {
    // will throw error if verification fails
    const decodedPayload = jwt.verify(sessionCookie, secretKey)
    if (typeof decodedPayload === typeof 'string') {
      throw new Error(`Payload of unexpected type. Content: ${decodedPayload}`)
    }
    cookiePayloadServerSession = decodedPayload as jwt.JwtPayload
  } catch (error) {
    throw new Error(`Could not verify JWT. --> ${error}`)
  }

  // console.log(
  //   `decoded JWT-Payload from Browser-Cookie:
  //   ${JSON.stringify(cookiePayloadServerSession, null, 2)}`
  // )

  try {
    // the body is the wrapper for the information send by the frontend
    // You could print it with:
    // console.log('body', request.body)

    // extract variables:
    const { extensionSession } = request.body
    const { encryptedChallenge, nonce } = extensionSession
    // This varible has different name depending on the session version
    let encryptionKeyUri: Kilt.DidResourceUri
    // if session is type PubSubSessionV1
    if ('encryptionKeyId' in extensionSession) {
      encryptionKeyUri = extensionSession.encryptionKeyId as Kilt.DidResourceUri
      // Version 1 had a misleading name for this variable
    } else {
      // if session is type PubSubSessionV2
      encryptionKeyUri = extensionSession.encryptionKeyUri
    }
    const encryptionKey = await Kilt.Did.resolveKey(encryptionKeyUri)
    if (!encryptionKey) {
      throw new Error('an encryption key is required')
    }

    // get your encryption Key, a.k.a. Key Agreement
    const dAppDidMnemonic = process.env.DAPP_DID_MNEMONIC
    if (!dAppDidMnemonic) {
      throw new Error('Enter your dApps mnemonic on the .env file')
    }

    const { keyAgreement } = generateKeypairs(dAppDidMnemonic)

    const decryptedBytes = Kilt.Utils.Crypto.decryptAsymmetric(
      { box: encryptedChallenge, nonce },
      // fetch from the chain:
      encryptionKey.publicKey,
      // derived from your seed phrase:
      keyAgreement.secretKey
    )
    // If it fails to decrypt, throw.
    if (!decryptedBytes) {
      throw new Error(
        'Could not decode/decrypt the challange from the extension'
      )
    }

    const decryptedChallenge = Kilt.Utils.Crypto.u8aToHex(decryptedBytes)
    const originalChallenge = cookiePayloadServerSession.challenge

    // Compare the decrypted challenge to the challenge you stored earlier.
    console.log(
      '\n',
      `original Challenge: ${originalChallenge} \n`,
      `decrypted Challenge: ${decryptedChallenge} \n`
    )
    if (decryptedChallenge !== originalChallenge) {
      response
        .status(401)
        .send("Session verification failed. The challenges don't match.")
      throw new Error('Invalid challenge')
    }

    console.log('Session successfully verified.\n')
    response
      .status(200)
      .send(
        'Session succesfully verified. Extension and dApp understand each other.'
      )
  } catch (err) {
    // print the possible error on the frontend
    next(err)
  }
}

/**
 * Retrieves Cookie with JSON-Web-Token of Session Values from the browser.
 *
 * @param request
 * @param response
 * @param next
 * @returns
 */
export async function getSessionJWT(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  const secretKey = process.env.JWT_ENCODER
  if (!secretKey) {
    throw new Error(
      "Define a value for 'JWT_ENCODER' on the '.env'-file first!"
    )
  }

  try {
    const sessionCookie = request.cookies.sessionJWT
    if (!sessionCookie) {
      throw new Error(
        'Cookie with Session JWT not found. Log-in and try again.'
      )
    }
    // decode the JWT and verify if it was signed with our SecretKey
    // will throw error if verification fails
    const decodedPayload = jwt.verify(sessionCookie, secretKey)

    console.log('type of te decodedPayload: ', typeof decodedPayload)
    console.log('decoded JWT-Payload from Browser-Cookie: ', decodedPayload)

    response
      .status(200)
      .send(
        'A Cookie with a JWT for the Session was succesfully retrieved from the browser.'
      )
  } catch (err) {
    // print the possible error on the frontend
    next(err)
    response
      .status(404)
      .send(
        `Could not find Cookie with session values or verify it's JWT's signature. \n ${err}`
      )
  }
}
