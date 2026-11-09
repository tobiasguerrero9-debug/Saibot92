import {JournalRepository,journalConfig} from '../server/journal/repository.js';
import {createJournalHandler} from '../server/journal/http.js';
let handler;
export default async function journal(req,res){try{handler??=createJournalHandler(new JournalRepository(journalConfig()));return await handler(req,res);}catch{res.statusCode=503;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Journal backend unavailable'}));}}
