// var fs = require('fs'), path = require('path'), util = require('util'), Stream = require('stream').Stream;
import * as fs from 'fs-extra';
import * as path from 'path';
import { Request } from 'express';
import logger from '../config/logger';

export class Resumable {
    public temporaryFolder: string;
    public maxFileSize: number;
    public fileParameterName: string;
    public identifier: {
       'roundNumber': number;
       'easelNumber': number;
       'EID': string;
       'prefixId': string;
       'hash': string;
       'eventId': string;
       'contestantId': string;
       'fileType': string;
       'id': string;
       'MediaId': string;
    };

    constructor() {
        this.maxFileSize = null;
        this.fileParameterName = 'file';
        // fs.mkdirSync(temporaryFolder);
    }

    cleanIdentifier(identifier: string) {
        const idObj = JSON.parse(identifier);
        this.identifier = idObj;
        return idObj.id;
    }

    getChunkFilename(chunkNumber: number, identifier: string) {
        // What would the file name be?
        return path.join(this.temporaryFolder, './resumable-' + identifier + '.' + chunkNumber);
    }

    validateRequest(chunkNumber: number, chunkSize: number, totalSize: number, identifier: string, filename: string, fileSize?: number) {
        // Check if the request is sane
        if (chunkNumber == 0 || chunkSize == 0 || totalSize == 0 || identifier.length == 0 || filename.length == 0) {
            return 'non_resumable_request';
        }
        // const numberOfChunks = Math.max(Math.floor(totalSize / (chunkSize * 1.0)), 1);
        const numberOfChunks = Math.max(Math.floor(totalSize / (chunkSize)), 1);
        if (chunkNumber > numberOfChunks) {
            return 'invalid_resumable_request1';
        }

        // Is the file too big?
        if (this.maxFileSize && totalSize > this.maxFileSize) {
            return 'invalid_resumable_request2';
        }

        if ( typeof(fileSize) != 'undefined') {
            if (chunkNumber < numberOfChunks && fileSize != chunkSize) {
                // The chunk in the POST request isn't the correct size
                return 'invalid_resumable_request3';
            }
            if (numberOfChunks > 1 && chunkNumber == numberOfChunks && fileSize != ((totalSize % chunkSize) + chunkSize)) {
                // The chunks in the POST is the last one, and the fil is not the correct size
                return 'invalid_resumable_request4';
            }
            if (numberOfChunks == 1 && fileSize != totalSize) {
                // The file is only a single chunk, and the data size does not fit
                return 'invalid_resumable_request5';
            }
        }

        return 'valid';
    }

    isFileExist (file: string) {
        return new Promise( (resolve) => {
            fs.access(file, fs.constants.F_OK | fs.constants.W_OK, (err) => {
                if (err) {
                    // err is not actual error its a test by client if a chunk exist or not
                    /*logger.error(
                        `${file} ${err.code === 'ENOENT' ? 'does not exist' : 'is read-only'}`);*/
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    // 'found', filename, originalFilename, identifier
    // 'not_found', null, null, null
    async get (req: Request) {
        const chunkNumber = req.query.resumableChunkNumber || 0;
        const chunkSize = req.query.resumableChunkSize || 0;
        const totalSize = req.query.resumableTotalSize || 0;
        const identifier = this.cleanIdentifier(req.query.resumableIdentifier) || '{}';
        if (identifier.fileType === 'photo') {
            this.temporaryFolder = path.resolve(`${__dirname}/../public/uploads/images/originals`);
        } else if (identifier.fileType === 'video') {
            this.temporaryFolder = path.resolve(`${__dirname}/../public/uploads/videos/originals`);
        } else {
            throw `Unsupported File type ${identifier.fileType} ${identifier.resumableFilename} [get]`;
        }
        const filename = req.query.resumableFilename || '';

        if (this.validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename) == 'valid') {
            const chunkFilename = this.getChunkFilename(chunkNumber, identifier);
            const exists = await this.isFileExist(chunkFilename);
            if (exists) {
                return {
                    status: true,
                    chunkFilename: chunkFilename,
                    fileName: filename,
                    identifier: identifier
                };
            } else {
                return {
                    status: false,
                    chunkFilename: chunkFilename,
                    fileName: filename,
                    identifier: identifier
                };
            }
        } else {
            return {
                status: false,
                chunkFilename: '',
                fileName: filename,
                identifier: identifier
            };
        }
    }

    // 'partly_done', filename, originalFilename, identifier
    // 'done', filename, originalFilename, identifier
    // 'invalid_resumable_request', null, null, null
    // 'non_resumable_request', null, null, null
    async post (req: Request): Promise<{
        validation: string;
        filename: string;
        originalFilename: string;
        identifier: string;
        outputFileName?: string;
    }> {

        const fields = req.body;
        // @ts-ignore
        const files = req.files;
        const chunkNumber = fields['resumableChunkNumber'];
        const chunkSize = fields['resumableChunkSize'];
        const totalSize = fields['resumableTotalSize'];
        const identifier = this.cleanIdentifier(fields['resumableIdentifier']);
        if (this.identifier.fileType === 'photo') {
            this.temporaryFolder = path.resolve(`${__dirname}/../public/uploads/images/originals`);
        } else if (this.identifier.fileType === 'video') {
            this.temporaryFolder = path.resolve(`${__dirname}/../public/uploads/videos/originals`);
        } else {
            throw `iUnsupported File type ${this.identifier.fileType} ${identifier.resumableFilename} [post]`;
        }
        const filename = fields['resumableFilename'];
        const me = this;

        const originalFilename = fields['resumableIdentifier'];
        let file: { size: string; path: string; };
        if (files && files.length > 0) {
            // @ts-ignore
            file = files[0]; // TODO support for multiple files
        }
        // const file = files[this.fileParameterName];
        // @ts-ignore
        if (!file || !file.size) {
            return {
                validation: 'invalid_resumable_request',
                filename: '',
                originalFilename: '',
                identifier: ''
            };
        }
        const validation = this.validateRequest(chunkNumber, chunkSize, totalSize, identifier, file.size);
        if ( validation == 'valid' ) {
            const chunkFilename = me.getChunkFilename(chunkNumber, identifier);

            // Save the chunk (TODO: OVERWRITE)
            await fs.rename(file.path, chunkFilename);

            // Do we have all the chunks?
            let currentTestChunk = 1;
            const numberOfChunks = Math.max(Math.floor(totalSize / (chunkSize * 1.0)), 1);
            async function testChunkExists(): Promise<{
                validation: string;
                filename: string;
                originalFilename: string;
                identifier: string;
                outputFileName?: string;
            }> {
                const exists = await me.isFileExist(me.getChunkFilename(currentTestChunk, identifier));
                if (exists) {
                    currentTestChunk++;
                    if (currentTestChunk > numberOfChunks) {
                        const outputFileName = `${me.temporaryFolder}/${identifier}${path.extname(filename)}`;
                        const writeStream = fs.createWriteStream(outputFileName);
                        // saving as a single file
                        await me.write(identifier, writeStream);
                        await me.clean(identifier);
                        return {
                            validation: 'done',
                            filename: filename,
                            originalFilename: originalFilename,
                            identifier: identifier,
                            outputFileName: outputFileName
                        };
                    } else {
                        // Recursion
                        return await testChunkExists();
                    }
                } else {
                    return {
                        validation: 'partly_done',
                        filename: filename,
                        originalFilename: originalFilename,
                        identifier: identifier
                    };
                }
            }
            return await testChunkExists();
        } else {

            return {
                validation: validation,
                filename: filename,
                originalFilename: originalFilename,
                identifier: identifier
            };
        }
    }


    // Pipe chunks directly in to an existing WritableStream
    //   r.write(identifier, response);
    //   r.write(identifier, response, {end:false});
    //
    //   var stream = fs.createWriteStream(filename);
    //   r.write(identifier, stream);
    //   stream.on('data', function(data){...});
    //   stream.on('end', function(){...});
    async write(identifier: string, writableStream: NodeJS.WritableStream, options?: {end?: boolean, onDone?: () => {}}) {
        options = options || {};
        options.end = (typeof options['end'] == 'undefined' ? true : options['end']);
        const me = this;
        // Iterate over each chunk
        const pipeChunk = async function(number: number) {
            const chunkFilename = me.getChunkFilename(number, identifier);
            const exists = await me.isFileExist(chunkFilename);
            if (exists) {
                // If the chunk with the current number exists,
                // then create a ReadStream from the file
                // and pipe it to the specified writableStream.
                await streamChunk(chunkFilename);
                // When the chunk is fully streamed,
                // jump to the next one
                await pipeChunk(number + 1);
            } else {
                // When all the chunks have been piped, end the stream
                if (options.end) writableStream.end();
                if (options.onDone) options.onDone();
            }

        };
        const streamChunk = function(chunkFilename: string) {
            return new Promise((resolve) => {
                const sourceStream = fs.createReadStream(chunkFilename);
                sourceStream.pipe(writableStream, {
                    end: false
                });
                sourceStream.on('end', async function() {
                    resolve();
                });
            });
        };
        const waitForWriteStreamToOpen = function() {
            return new Promise((resolve) => {
                writableStream.on('open', function () {
                    resolve();
                });
            });
        };
        await waitForWriteStreamToOpen();
        await pipeChunk(1);
    }


    async clean(identifier: string) {
        // Iterate over each chunk
        const me = this;
        const pipeChunkRm = async function (number: number) {
            const chunkFilename = me.getChunkFilename(number, identifier);
            const exists = await me.isFileExist(chunkFilename);
            if (exists) {
                try {
                    await fs.unlink(chunkFilename);
                } catch (e) {
                    logger.error(`unlink error in clean -resumable ${e}`);
                }
                await pipeChunkRm(number + 1);

            } else {
                return ;
            }
        };
        return await pipeChunkRm(1);
    }
}