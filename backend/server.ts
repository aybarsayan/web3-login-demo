import dotenv from 'dotenv';
import path from 'path';
import express, { Express, Request, Response, Router } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { generateSessionValues, verifySession } from './src/session/session';

// Letting the server know where the environment varibles are
const projectRoootDirectory = path.dirname(__dirname);
dotenv.config({ path: `${projectRoootDirectory}/.env` });


const app: Express = express();
const PORT = process.env.PORT || 3000;



app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.use(cors({ origin: [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`, `http://[::1]:${PORT}`] }));

app.get('/api', (req: Request, res: Response) => {
  console.log(`'/api' triggered`);
  res.status(200).json('Welcome to the API for the KILT Web3 Login');
});

app.get('/api/session/start', generateSessionValues);

app.post('/api/session/verify', verifySession);



app.listen(PORT, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
});
