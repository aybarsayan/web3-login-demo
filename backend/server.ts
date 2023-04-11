import path from 'path'

import dotenv from 'dotenv'
import express, { Express, NextFunction, Request, Response } from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'

import { startSession } from './src/session/startSession'
import { verifySession } from './src/session/verifySession'

import { fetchDidDocument } from './src/utils/fetchDidDocument'

// Letting the server know where the environment varibles are
const projectRoootDirectory = path.dirname(__dirname)
dotenv.config({ path: `${projectRoootDirectory}/.env` })

const app: Express = express()
const PORT = process.env.PORT || 3000

// Activating Middleware:

// for parsing application/json
app.use(bodyParser.json())
// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }))

// Tell the browser that only these URLs should be allowed to make request to this server.
// If you host the app using a different URL, you need to add it here.
app.use(
  cors({
    origin: [
      `http://localhost:${PORT}`,
      `http://127.0.0.1:${PORT}`,
      `http://[::1]:${PORT}`
    ]
  })
)

// Utility to read cookies. Backing has never been easier.
app.use(cookieParser())

// Printing the URL that requested the server
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`Trigger: ${req.url}`)
  next()
})

// Setting GET and POST functions

app.get('/api', (req: Request, res: Response) => {
  res.status(200).json('Welcome to the API for the KILT Web3 Login')
})

// manage Session:

// Login:
// Starts the session from server side.
app.get('/api/session/start', startSession)
// Process session values from the extension and verify that secure comunication is stablish. (compares challenge)
app.post('/api/session/verify', verifySession)

// We need the DID Document of the dApps DID (DAPP_DID_URI) before we can handle login requests.
// We therefore start the server only after the document was fetched.
fetchDidDocument()
  .then((doccy) => {
    app.locals.dappDidDocument = doccy
    // wait for fetched document before server starts listening:
    app.listen(PORT, () => {
      console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`)
    })
  })
  .catch((error) => {
    console.log(`Could not start server! ${error}`)
  })
