import * as path from 'path';

const fs = require('fs-extra');
import { google } from 'googleapis';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = path.join(__dirname, `../data/google_sheets/token.json`);
import logger from '../config/logger';

const privateKey = require(`../data/google_sheets/${process.env.SERVICE_ACCOUNT_FILE}`);

export const ExportToExcelClass = class ExportToExcel {
    /*async init() {
        const content = await fs.readFile(path.join(__dirname, `../data/google_sheets/credentials.json`));
        await ExportToExcel.authorize(JSON.parse(content), this.insertInSheet);
    }

    static getNewToken(oAuth2Client: { generateAuthUrl: (arg0: { access_type: string; scope: string[] }) => void; getToken: (arg0: any, arg1: (err: any, token: any) => void) => void; setCredentials: (arg0: any) => void }, callback: (oAuth2Client: any) => void) {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });
        logger.info('Authorize this app by visiting this url:', authUrl);
        oAuth2Client.getToken('<put code obtained by link here>', (err: any, token: any) => {
            if (err) return console.error('Error while trying to retrieve access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err: any) => {
                if (err) return console.error(err);
                logger.info('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    }

    static async authorize(credentials: { installed: { client_secret: any; client_id: any; redirect_uris: any } }, callback: (oAuth2Client: any) => void) {
        const {client_secret, client_id, redirect_uris} = credentials.installed;
        const oAuth2Client = new google.auth.OAuth2(
            client_id, client_secret, redirect_uris[0]);
        try {
            // Check if we have previously stored a token.
            const token = await fs.readFile(TOKEN_PATH);
            oAuth2Client.setCredentials(JSON.parse(token));
            callback(oAuth2Client);
        } catch (e) {
            return ExportToExcel.getNewToken(oAuth2Client, callback);
        }
    }*/
    public jwtClient: { authorize: () => void; setCredentials: (arg0: any) => void; };

    constructor() {
        this.jwtClient = new google.auth.JWT(
            privateKey.client_email,
            null,
            privateKey.private_key,
            ['https://www.googleapis.com/auth/spreadsheets']);
    }

    async insertInSheet(excelRows: [string[]?] = [[]]) {
        const tokens = await this.jwtClient.authorize();
        this.jwtClient.setCredentials(tokens);
        google.options({
            // @ts-ignore
            auth: this.jwtClient
        });

        /*const credentials = JSON.parse(await fs.readFile(path.join(__dirname, `../data/google_sheets/credentials.json`)));
        const {client_secret, client_id, redirect_uris} = credentials.installed;
        const oAuth2Client = new google.auth.OAuth2(
            client_id, client_secret, redirect_uris[0]);
        const token = await fs.readFile(TOKEN_PATH);
        oAuth2Client.setCredentials(JSON.parse(token));*/
        const result = await google.sheets('v4').spreadsheets.values.append({
            // @ts-ignore
            // auth: oAuth2Client,
            range: 'A1',
            spreadsheetId: '1T4X2sEzmH_oEWEkzRFGTrcPLC2CfFvzYHkY0jppSpBk',
            includeValuesInResponse: true,
            insertDataOption: 'INSERT_ROWS',
            responseDateTimeRenderOption: 'FORMATTED_STRING',
            responseValueRenderOption: 'UNFORMATTED_VALUE',
            valueInputOption: 'RAW',
            resource: {
                values: excelRows
            }
        });
        logger.info(result);
    }
};


