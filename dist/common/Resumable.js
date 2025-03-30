"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Resumable = void 0;
// var fs = require('fs'), path = require('path'), util = require('util'), Stream = require('stream').Stream;
const fs = require("fs-extra");
const path = require("path");
const logger_1 = require("../config/logger");
class Resumable {
    constructor() {
        this.maxFileSize = null;
        this.fileParameterName = 'file';
        // fs.mkdirSync(temporaryFolder);
    }
    cleanIdentifier(identifier) {
        const idObj = JSON.parse(identifier);
        this.identifier = idObj;
        return idObj.id;
    }
    getChunkFilename(chunkNumber, identifier) {
        // What would the file name be?
        return path.join(this.temporaryFolder, './resumable-' + identifier + '.' + chunkNumber);
    }
    validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename, fileSize) {
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
        if (typeof (fileSize) != 'undefined') {
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
    isFileExist(file) {
        return new Promise((resolve) => {
            fs.access(file, fs.constants.F_OK | fs.constants.W_OK, (err) => {
                if (err) {
                    // err is not actual error its a test by client if a chunk exist or not
                    /*logger.error(
                        `${file} ${err.code === 'ENOENT' ? 'does not exist' : 'is read-only'}`);*/
                    resolve(false);
                }
                else {
                    resolve(true);
                }
            });
        });
    }
    // 'found', filename, originalFilename, identifier
    // 'not_found', null, null, null
    async get(req) {
        const chunkNumber = req.query.resumableChunkNumber || 0;
        const chunkSize = req.query.resumableChunkSize || 0;
        const totalSize = req.query.resumableTotalSize || 0;
        const identifier = this.cleanIdentifier(req.query.resumableIdentifier) || '{}';
        if (identifier.fileType === 'photo') {
            this.temporaryFolder = path.resolve(`${__dirname}/../public/uploads/images/originals`);
        }
        else if (identifier.fileType === 'video') {
            this.temporaryFolder = path.resolve(`${__dirname}/../public/uploads/videos/originals`);
        }
        else {
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
            }
            else {
                return {
                    status: false,
                    chunkFilename: chunkFilename,
                    fileName: filename,
                    identifier: identifier
                };
            }
        }
        else {
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
    async post(req) {
        const fields = req.body;
        // @ts-ignore
        const files = req.files;
        const chunkNumber = fields['resumableChunkNumber'];
        const chunkSize = fields['resumableChunkSize'];
        const totalSize = fields['resumableTotalSize'];
        const identifier = this.cleanIdentifier(fields['resumableIdentifier']);
        if (this.identifier.fileType === 'photo') {
            this.temporaryFolder = path.resolve(`${__dirname}/../public/uploads/images/originals`);
        }
        else if (this.identifier.fileType === 'video') {
            this.temporaryFolder = path.resolve(`${__dirname}/../public/uploads/videos/originals`);
        }
        else {
            throw `iUnsupported File type ${this.identifier.fileType} ${identifier.resumableFilename} [post]`;
        }
        const filename = fields['resumableFilename'];
        const me = this;
        const originalFilename = fields['resumableIdentifier'];
        let file;
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
        if (validation == 'valid') {
            const chunkFilename = me.getChunkFilename(chunkNumber, identifier);
            // Save the chunk (TODO: OVERWRITE)
            await fs.rename(file.path, chunkFilename);
            // Do we have all the chunks?
            let currentTestChunk = 1;
            const numberOfChunks = Math.max(Math.floor(totalSize / (chunkSize * 1.0)), 1);
            async function testChunkExists() {
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
                    }
                    else {
                        // Recursion
                        return await testChunkExists();
                    }
                }
                else {
                    return {
                        validation: 'partly_done',
                        filename: filename,
                        originalFilename: originalFilename,
                        identifier: identifier
                    };
                }
            }
            return await testChunkExists();
        }
        else {
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
    async write(identifier, writableStream, options) {
        options = options || {};
        options.end = (typeof options['end'] == 'undefined' ? true : options['end']);
        const me = this;
        // Iterate over each chunk
        const pipeChunk = async function (number) {
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
            }
            else {
                // When all the chunks have been piped, end the stream
                if (options.end)
                    writableStream.end();
                if (options.onDone)
                    options.onDone();
            }
        };
        const streamChunk = function (chunkFilename) {
            return new Promise((resolve) => {
                const sourceStream = fs.createReadStream(chunkFilename);
                sourceStream.pipe(writableStream, {
                    end: false
                });
                sourceStream.on('end', async function () {
                    resolve();
                });
            });
        };
        const waitForWriteStreamToOpen = function () {
            return new Promise((resolve) => {
                writableStream.on('open', function () {
                    resolve();
                });
            });
        };
        await waitForWriteStreamToOpen();
        await pipeChunk(1);
    }
    async clean(identifier) {
        // Iterate over each chunk
        const me = this;
        const pipeChunkRm = async function (number) {
            const chunkFilename = me.getChunkFilename(number, identifier);
            const exists = await me.isFileExist(chunkFilename);
            if (exists) {
                try {
                    await fs.unlink(chunkFilename);
                }
                catch (e) {
                    logger_1.default.error(`unlink error in clean -resumable ${e}`);
                }
                await pipeChunkRm(number + 1);
            }
            else {
                return;
            }
        };
        return await pipeChunkRm(1);
    }
}
exports.Resumable = Resumable;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUM7UUFDRixNQUFNLHdCQUF3QixFQUFFLENBQUM7UUFDakMsTUFBTSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdkIsQ0FBQztJQUdELEtBQUssQ0FBQyxLQUFLLENBQUMsVUFBa0I7UUFDMUIsMEJBQTBCO1FBQzFCLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQztRQUNoQixNQUFNLFdBQVcsR0FBRyxLQUFLLFdBQVcsTUFBYztZQUM5QyxNQUFNLGFBQWEsR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQzlELE1BQU0sTUFBTSxHQUFHLE1BQU0sRUFBRSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUNuRCxJQUFJLE1BQU0sRUFBRTtnQkFDUixJQUFJO29CQUNBLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztpQkFDbEM7Z0JBQUMsT0FBTyxDQUFDLEVBQUU7b0JBQ1IsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsb0NBQW9DLENBQUMsRUFBRSxDQUFDLENBQUM7aUJBQ3pEO2dCQUNELE1BQU0sV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQzthQUVqQztpQkFBTTtnQkFDSCxPQUFRO2FBQ1g7UUFDTCxDQUFDLENBQUM7UUFDRixPQUFPLE1BQU0sV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2hDLENBQUM7Q0FDSjtBQWpURCw4QkFpVEMiLCJmaWxlIjoiY29tbW9uL1Jlc3VtYWJsZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIHZhciBmcyA9IHJlcXVpcmUoJ2ZzJyksIHBhdGggPSByZXF1aXJlKCdwYXRoJyksIHV0aWwgPSByZXF1aXJlKCd1dGlsJyksIFN0cmVhbSA9IHJlcXVpcmUoJ3N0cmVhbScpLlN0cmVhbTtcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzLWV4dHJhJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBSZXF1ZXN0IH0gZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgbG9nZ2VyIGZyb20gJy4uL2NvbmZpZy9sb2dnZXInO1xuXG5leHBvcnQgY2xhc3MgUmVzdW1hYmxlIHtcbiAgICBwdWJsaWMgdGVtcG9yYXJ5Rm9sZGVyOiBzdHJpbmc7XG4gICAgcHVibGljIG1heEZpbGVTaXplOiBudW1iZXI7XG4gICAgcHVibGljIGZpbGVQYXJhbWV0ZXJOYW1lOiBzdHJpbmc7XG4gICAgcHVibGljIGlkZW50aWZpZXI6IHtcbiAgICAgICAncm91bmROdW1iZXInOiBudW1iZXI7XG4gICAgICAgJ2Vhc2VsTnVtYmVyJzogbnVtYmVyO1xuICAgICAgICdFSUQnOiBzdHJpbmc7XG4gICAgICAgJ3ByZWZpeElkJzogc3RyaW5nO1xuICAgICAgICdoYXNoJzogc3RyaW5nO1xuICAgICAgICdldmVudElkJzogc3RyaW5nO1xuICAgICAgICdjb250ZXN0YW50SWQnOiBzdHJpbmc7XG4gICAgICAgJ2ZpbGVUeXBlJzogc3RyaW5nO1xuICAgICAgICdpZCc6IHN0cmluZztcbiAgICAgICAnTWVkaWFJZCc6IHN0cmluZztcbiAgICB9O1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMubWF4RmlsZVNpemUgPSBudWxsO1xuICAgICAgICB0aGlzLmZpbGVQYXJhbWV0ZXJOYW1lID0gJ2ZpbGUnO1xuICAgICAgICAvLyBmcy5ta2RpclN5bmModGVtcG9yYXJ5Rm9sZGVyKTtcbiAgICB9XG5cbiAgICBjbGVhbklkZW50aWZpZXIoaWRlbnRpZmllcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGlkT2JqID0gSlNPTi5wYXJzZShpZGVudGlmaWVyKTtcbiAgICAgICAgdGhpcy5pZGVudGlmaWVyID0gaWRPYmo7XG4gICAgICAgIHJldHVybiBpZE9iai5pZDtcbiAgICB9XG5cbiAgICBnZXRDaHVua0ZpbGVuYW1lKGNodW5rTnVtYmVyOiBudW1iZXIsIGlkZW50aWZpZXI6IHN0cmluZykge1xuICAgICAgICAvLyBXaGF0IHdvdWxkIHRoZSBmaWxlIG5hbWUgYmU/XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4odGhpcy50ZW1wb3JhcnlGb2xkZXIsICcuL3Jlc3VtYWJsZS0nICsgaWRlbnRpZmllciArICcuJyArIGNodW5rTnVtYmVyKTtcbiAgICB9XG5cbiAgICB2YWxpZGF0ZVJlcXVlc3QoY2h1bmtOdW1iZXI6IG51bWJlciwgY2h1bmtTaXplOiBudW1iZXIsIHRvdGFsU2l6ZTogbnVtYmVyLCBpZGVudGlmaWVyOiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcsIGZpbGVTaXplPzogbnVtYmVyKSB7XG4gICAgICAgIC8vIENoZWNrIGlmIHRoZSByZXF1ZXN0IGlzIHNhbmVcbiAgICAgICAgaWYgKGNodW5rTnVtYmVyID09IDAgfHwgY2h1bmtTaXplID09IDAgfHwgdG90YWxTaXplID09IDAgfHwgaWRlbnRpZmllci5sZW5ndGggPT0gMCB8fCBmaWxlbmFtZS5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuICdub25fcmVzdW1hYmxlX3JlcXVlc3QnO1xuICAgICAgICB9XG4gICAgICAgIC8vIGNvbnN0IG51bWJlck9mQ2h1bmtzID0gTWF0aC5tYXgoTWF0aC5mbG9vcih0b3RhbFNpemUgLyAoY2h1bmtTaXplICogMS4wKSksIDEpO1xuICAgICAgICBjb25zdCBudW1iZXJPZkNodW5rcyA9IE1hdGgubWF4KE1hdGguZmxvb3IodG90YWxTaXplIC8gKGNodW5rU2l6ZSkpLCAxKTtcbiAgICAgICAgaWYgKGNodW5rTnVtYmVyID4gbnVtYmVyT2ZDaHVua3MpIHtcbiAgICAgICAgICAgIHJldHVybiAnaW52YWxpZF9yZXN1bWFibGVfcmVxdWVzdDEnO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSXMgdGhlIGZpbGUgdG9vIGJpZz9cbiAgICAgICAgaWYgKHRoaXMubWF4RmlsZVNpemUgJiYgdG90YWxTaXplID4gdGhpcy5tYXhGaWxlU2l6ZSkge1xuICAgICAgICAgICAgcmV0dXJuICdpbnZhbGlkX3Jlc3VtYWJsZV9yZXF1ZXN0Mic7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIHR5cGVvZihmaWxlU2l6ZSkgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGlmIChjaHVua051bWJlciA8IG51bWJlck9mQ2h1bmtzICYmIGZpbGVTaXplICE9IGNodW5rU2l6ZSkge1xuICAgICAgICAgICAgICAgIC8vIFRoZSBjaHVuayBpbiB0aGUgUE9TVCByZXF1ZXN0IGlzbid0IHRoZSBjb3JyZWN0IHNpemVcbiAgICAgICAgICAgICAgICByZXR1cm4gJ2ludmFsaWRfcmVzdW1hYmxlX3JlcXVlc3QzJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChudW1iZXJPZkNodW5rcyA+IDEgJiYgY2h1bmtOdW1iZXIgPT0gbnVtYmVyT2ZDaHVua3MgJiYgZmlsZVNpemUgIT0gKCh0b3RhbFNpemUgJSBjaHVua1NpemUpICsgY2h1bmtTaXplKSkge1xuICAgICAgICAgICAgICAgIC8vIFRoZSBjaHVua3MgaW4gdGhlIFBPU1QgaXMgdGhlIGxhc3Qgb25lLCBhbmQgdGhlIGZpbCBpcyBub3QgdGhlIGNvcnJlY3Qgc2l6ZVxuICAgICAgICAgICAgICAgIHJldHVybiAnaW52YWxpZF9yZXN1bWFibGVfcmVxdWVzdDQnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG51bWJlck9mQ2h1bmtzID09IDEgJiYgZmlsZVNpemUgIT0gdG90YWxTaXplKSB7XG4gICAgICAgICAgICAgICAgLy8gVGhlIGZpbGUgaXMgb25seSBhIHNpbmdsZSBjaHVuaywgYW5kIHRoZSBkYXRhIHNpemUgZG9lcyBub3QgZml0XG4gICAgICAgICAgICAgICAgcmV0dXJuICdpbnZhbGlkX3Jlc3VtYWJsZV9yZXF1ZXN0NSc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gJ3ZhbGlkJztcbiAgICB9XG5cbiAgICBpc0ZpbGVFeGlzdCAoZmlsZTogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSggKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIGZzLmFjY2VzcyhmaWxlLCBmcy5jb25zdGFudHMuRl9PSyB8IGZzLmNvbnN0YW50cy5XX09LLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAvLyBlcnIgaXMgbm90IGFjdHVhbCBlcnJvciBpdHMgYSB0ZXN0IGJ5IGNsaWVudCBpZiBhIGNodW5rIGV4aXN0IG9yIG5vdFxuICAgICAgICAgICAgICAgICAgICAvKmxvZ2dlci5lcnJvcihcbiAgICAgICAgICAgICAgICAgICAgICAgIGAke2ZpbGV9ICR7ZXJyLmNvZGUgPT09ICdFTk9FTlQnID8gJ2RvZXMgbm90IGV4aXN0JyA6ICdpcyByZWFkLW9ubHknfWApOyovXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZmFsc2UpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vICdmb3VuZCcsIGZpbGVuYW1lLCBvcmlnaW5hbEZpbGVuYW1lLCBpZGVudGlmaWVyXG4gICAgLy8gJ25vdF9mb3VuZCcsIG51bGwsIG51bGwsIG51bGxcbiAgICBhc3luYyBnZXQgKHJlcTogUmVxdWVzdCkge1xuICAgICAgICBjb25zdCBjaHVua051bWJlciA9IHJlcS5xdWVyeS5yZXN1bWFibGVDaHVua051bWJlciB8fCAwO1xuICAgICAgICBjb25zdCBjaHVua1NpemUgPSByZXEucXVlcnkucmVzdW1hYmxlQ2h1bmtTaXplIHx8IDA7XG4gICAgICAgIGNvbnN0IHRvdGFsU2l6ZSA9IHJlcS5xdWVyeS5yZXN1bWFibGVUb3RhbFNpemUgfHwgMDtcbiAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IHRoaXMuY2xlYW5JZGVudGlmaWVyKHJlcS5xdWVyeS5yZXN1bWFibGVJZGVudGlmaWVyKSB8fCAne30nO1xuICAgICAgICBpZiAoaWRlbnRpZmllci5maWxlVHlwZSA9PT0gJ3Bob3RvJykge1xuICAgICAgICAgICAgdGhpcy50ZW1wb3JhcnlGb2xkZXIgPSBwYXRoLnJlc29sdmUoYCR7X19kaXJuYW1lfS8uLi9wdWJsaWMvdXBsb2Fkcy9pbWFnZXMvb3JpZ2luYWxzYCk7XG4gICAgICAgIH0gZWxzZSBpZiAoaWRlbnRpZmllci5maWxlVHlwZSA9PT0gJ3ZpZGVvJykge1xuICAgICAgICAgICAgdGhpcy50ZW1wb3JhcnlGb2xkZXIgPSBwYXRoLnJlc29sdmUoYCR7X19kaXJuYW1lfS8uLi9wdWJsaWMvdXBsb2Fkcy92aWRlb3Mvb3JpZ2luYWxzYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBgVW5zdXBwb3J0ZWQgRmlsZSB0eXBlICR7aWRlbnRpZmllci5maWxlVHlwZX0gJHtpZGVudGlmaWVyLnJlc3VtYWJsZUZpbGVuYW1lfSBbZ2V0XWA7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZmlsZW5hbWUgPSByZXEucXVlcnkucmVzdW1hYmxlRmlsZW5hbWUgfHwgJyc7XG5cbiAgICAgICAgaWYgKHRoaXMudmFsaWRhdGVSZXF1ZXN0KGNodW5rTnVtYmVyLCBjaHVua1NpemUsIHRvdGFsU2l6ZSwgaWRlbnRpZmllciwgZmlsZW5hbWUpID09ICd2YWxpZCcpIHtcbiAgICAgICAgICAgIGNvbnN0IGNodW5rRmlsZW5hbWUgPSB0aGlzLmdldENodW5rRmlsZW5hbWUoY2h1bmtOdW1iZXIsIGlkZW50aWZpZXIpO1xuICAgICAgICAgICAgY29uc3QgZXhpc3RzID0gYXdhaXQgdGhpcy5pc0ZpbGVFeGlzdChjaHVua0ZpbGVuYW1lKTtcbiAgICAgICAgICAgIGlmIChleGlzdHMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGNodW5rRmlsZW5hbWU6IGNodW5rRmlsZW5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGZpbGVOYW1lOiBmaWxlbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgaWRlbnRpZmllcjogaWRlbnRpZmllclxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1czogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGNodW5rRmlsZW5hbWU6IGNodW5rRmlsZW5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGZpbGVOYW1lOiBmaWxlbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgaWRlbnRpZmllcjogaWRlbnRpZmllclxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN0YXR1czogZmFsc2UsXG4gICAgICAgICAgICAgICAgY2h1bmtGaWxlbmFtZTogJycsXG4gICAgICAgICAgICAgICAgZmlsZU5hbWU6IGZpbGVuYW1lLFxuICAgICAgICAgICAgICAgIGlkZW50aWZpZXI6IGlkZW50aWZpZXJcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyAncGFydGx5X2RvbmUnLCBmaWxlbmFtZSwgb3JpZ2luYWxGaWxlbmFtZSwgaWRlbnRpZmllclxuICAgIC8vICdkb25lJywgZmlsZW5hbWUsIG9yaWdpbmFsRmlsZW5hbWUsIGlkZW50aWZpZXJcbiAgICAvLyAnaW52YWxpZF9yZXN1bWFibGVfcmVxdWVzdCcsIG51bGwsIG51bGwsIG51bGxcbiAgICAvLyAnbm9uX3Jlc3VtYWJsZV9yZXF1ZXN0JywgbnVsbCwgbnVsbCwgbnVsbFxuICAgIGFzeW5jIHBvc3QgKHJlcTogUmVxdWVzdCk6IFByb21pc2U8e1xuICAgICAgICB2YWxpZGF0aW9uOiBzdHJpbmc7XG4gICAgICAgIGZpbGVuYW1lOiBzdHJpbmc7XG4gICAgICAgIG9yaWdpbmFsRmlsZW5hbWU6IHN0cmluZztcbiAgICAgICAgaWRlbnRpZmllcjogc3RyaW5nO1xuICAgICAgICBvdXRwdXRGaWxlTmFtZT86IHN0cmluZztcbiAgICB9PiB7XG5cbiAgICAgICAgY29uc3QgZmllbGRzID0gcmVxLmJvZHk7XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgY29uc3QgZmlsZXMgPSByZXEuZmlsZXM7XG4gICAgICAgIGNvbnN0IGNodW5rTnVtYmVyID0gZmllbGRzWydyZXN1bWFibGVDaHVua051bWJlciddO1xuICAgICAgICBjb25zdCBjaHVua1NpemUgPSBmaWVsZHNbJ3Jlc3VtYWJsZUNodW5rU2l6ZSddO1xuICAgICAgICBjb25zdCB0b3RhbFNpemUgPSBmaWVsZHNbJ3Jlc3VtYWJsZVRvdGFsU2l6ZSddO1xuICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gdGhpcy5jbGVhbklkZW50aWZpZXIoZmllbGRzWydyZXN1bWFibGVJZGVudGlmaWVyJ10pO1xuICAgICAgICBpZiAodGhpcy5pZGVudGlmaWVyLmZpbGVUeXBlID09PSAncGhvdG8nKSB7XG4gICAgICAgICAgICB0aGlzLnRlbXBvcmFyeUZvbGRlciA9IHBhdGgucmVzb2x2ZShgJHtfX2Rpcm5hbWV9Ly4uL3B1YmxpYy91cGxvYWRzL2ltYWdlcy9vcmlnaW5hbHNgKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmlkZW50aWZpZXIuZmlsZVR5cGUgPT09ICd2aWRlbycpIHtcbiAgICAgICAgICAgIHRoaXMudGVtcG9yYXJ5Rm9sZGVyID0gcGF0aC5yZXNvbHZlKGAke19fZGlybmFtZX0vLi4vcHVibGljL3VwbG9hZHMvdmlkZW9zL29yaWdpbmFsc2ApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgYGlVbnN1cHBvcnRlZCBGaWxlIHR5cGUgJHt0aGlzLmlkZW50aWZpZXIuZmlsZVR5cGV9ICR7aWRlbnRpZmllci5yZXN1bWFibGVGaWxlbmFtZX0gW3Bvc3RdYDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBmaWxlbmFtZSA9IGZpZWxkc1sncmVzdW1hYmxlRmlsZW5hbWUnXTtcbiAgICAgICAgY29uc3QgbWUgPSB0aGlzO1xuXG4gICAgICAgIGNvbnN0IG9yaWdpbmFsRmlsZW5hbWUgPSBmaWVsZHNbJ3Jlc3VtYWJsZUlkZW50aWZpZXInXTtcbiAgICAgICAgbGV0IGZpbGU6IHsgc2l6ZTogc3RyaW5nOyBwYXRoOiBzdHJpbmc7IH07XG4gICAgICAgIGlmIChmaWxlcyAmJiBmaWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICBmaWxlID0gZmlsZXNbMF07IC8vIFRPRE8gc3VwcG9ydCBmb3IgbXVsdGlwbGUgZmlsZXNcbiAgICAgICAgfVxuICAgICAgICAvLyBjb25zdCBmaWxlID0gZmlsZXNbdGhpcy5maWxlUGFyYW1ldGVyTmFtZV07XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgaWYgKCFmaWxlIHx8ICFmaWxlLnNpemUpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogJ2ludmFsaWRfcmVzdW1hYmxlX3JlcXVlc3QnLFxuICAgICAgICAgICAgICAgIGZpbGVuYW1lOiAnJyxcbiAgICAgICAgICAgICAgICBvcmlnaW5hbEZpbGVuYW1lOiAnJyxcbiAgICAgICAgICAgICAgICBpZGVudGlmaWVyOiAnJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB2YWxpZGF0aW9uID0gdGhpcy52YWxpZGF0ZVJlcXVlc3QoY2h1bmtOdW1iZXIsIGNodW5rU2l6ZSwgdG90YWxTaXplLCBpZGVudGlmaWVyLCBmaWxlLnNpemUpO1xuICAgICAgICBpZiAoIHZhbGlkYXRpb24gPT0gJ3ZhbGlkJyApIHtcbiAgICAgICAgICAgIGNvbnN0IGNodW5rRmlsZW5hbWUgPSBtZS5nZXRDaHVua0ZpbGVuYW1lKGNodW5rTnVtYmVyLCBpZGVudGlmaWVyKTtcblxuICAgICAgICAgICAgLy8gU2F2ZSB0aGUgY2h1bmsgKFRPRE86IE9WRVJXUklURSlcbiAgICAgICAgICAgIGF3YWl0IGZzLnJlbmFtZShmaWxlLnBhdGgsIGNodW5rRmlsZW5hbWUpO1xuXG4gICAgICAgICAgICAvLyBEbyB3ZSBoYXZlIGFsbCB0aGUgY2h1bmtzP1xuICAgICAgICAgICAgbGV0IGN1cnJlbnRUZXN0Q2h1bmsgPSAxO1xuICAgICAgICAgICAgY29uc3QgbnVtYmVyT2ZDaHVua3MgPSBNYXRoLm1heChNYXRoLmZsb29yKHRvdGFsU2l6ZSAvIChjaHVua1NpemUgKiAxLjApKSwgMSk7XG4gICAgICAgICAgICBhc3luYyBmdW5jdGlvbiB0ZXN0Q2h1bmtFeGlzdHMoKTogUHJvbWlzZTx7XG4gICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogc3RyaW5nO1xuICAgICAgICAgICAgICAgIGZpbGVuYW1lOiBzdHJpbmc7XG4gICAgICAgICAgICAgICAgb3JpZ2luYWxGaWxlbmFtZTogc3RyaW5nO1xuICAgICAgICAgICAgICAgIGlkZW50aWZpZXI6IHN0cmluZztcbiAgICAgICAgICAgICAgICBvdXRwdXRGaWxlTmFtZT86IHN0cmluZztcbiAgICAgICAgICAgIH0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBleGlzdHMgPSBhd2FpdCBtZS5pc0ZpbGVFeGlzdChtZS5nZXRDaHVua0ZpbGVuYW1lKGN1cnJlbnRUZXN0Q2h1bmssIGlkZW50aWZpZXIpKTtcbiAgICAgICAgICAgICAgICBpZiAoZXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRUZXN0Q2h1bmsrKztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRUZXN0Q2h1bmsgPiBudW1iZXJPZkNodW5rcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3V0cHV0RmlsZU5hbWUgPSBgJHttZS50ZW1wb3JhcnlGb2xkZXJ9LyR7aWRlbnRpZmllcn0ke3BhdGguZXh0bmFtZShmaWxlbmFtZSl9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHdyaXRlU3RyZWFtID0gZnMuY3JlYXRlV3JpdGVTdHJlYW0ob3V0cHV0RmlsZU5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2F2aW5nIGFzIGEgc2luZ2xlIGZpbGVcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IG1lLndyaXRlKGlkZW50aWZpZXIsIHdyaXRlU3RyZWFtKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IG1lLmNsZWFuKGlkZW50aWZpZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiAnZG9uZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yaWdpbmFsRmlsZW5hbWU6IG9yaWdpbmFsRmlsZW5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWRlbnRpZmllcjogaWRlbnRpZmllcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRGaWxlTmFtZTogb3V0cHV0RmlsZU5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBSZWN1cnNpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0ZXN0Q2h1bmtFeGlzdHMoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWxpZGF0aW9uOiAncGFydGx5X2RvbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZW5hbWU6IGZpbGVuYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWxGaWxlbmFtZTogb3JpZ2luYWxGaWxlbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkZW50aWZpZXI6IGlkZW50aWZpZXJcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgdGVzdENodW5rRXhpc3RzKCk7XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdmFsaWRhdGlvbjogdmFsaWRhdGlvbixcbiAgICAgICAgICAgICAgICBmaWxlbmFtZTogZmlsZW5hbWUsXG4gICAgICAgICAgICAgICAgb3JpZ2luYWxGaWxlbmFtZTogb3JpZ2luYWxGaWxlbmFtZSxcbiAgICAgICAgICAgICAgICBpZGVudGlmaWVyOiBpZGVudGlmaWVyXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICAvLyBQaXBlIGNodW5rcyBkaXJlY3RseSBpbiB0byBhbiBleGlzdGluZyBXcml0YWJsZVN0cmVhbVxuICAgIC8vICAgci53cml0ZShpZGVudGlmaWVyLCByZXNwb25zZSk7XG4gICAgLy8gICByLndyaXRlKGlkZW50aWZpZXIsIHJlc3BvbnNlLCB7ZW5kOmZhbHNlfSk7XG4gICAgLy9cbiAgICAvLyAgIHZhciBzdHJlYW0gPSBmcy5jcmVhdGVXcml0ZVN0cmVhbShmaWxlbmFtZSk7XG4gICAgLy8gICByLndyaXRlKGlkZW50aWZpZXIsIHN0cmVhbSk7XG4gICAgLy8gICBzdHJlYW0ub24oJ2RhdGEnLCBmdW5jdGlvbihkYXRhKXsuLi59KTtcbiAgICAvLyAgIHN0cmVhbS5vbignZW5kJywgZnVuY3Rpb24oKXsuLi59KTtcbiAgICBhc3luYyB3cml0ZShpZGVudGlmaWVyOiBzdHJpbmcsIHdyaXRhYmxlU3RyZWFtOiBOb2RlSlMuV3JpdGFibGVTdHJlYW0sIG9wdGlvbnM/OiB7ZW5kPzogYm9vbGVhbiwgb25Eb25lPzogKCkgPT4ge319KSB7XG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgICBvcHRpb25zLmVuZCA9ICh0eXBlb2Ygb3B0aW9uc1snZW5kJ10gPT0gJ3VuZGVmaW5lZCcgPyB0cnVlIDogb3B0aW9uc1snZW5kJ10pO1xuICAgICAgICBjb25zdCBtZSA9IHRoaXM7XG4gICAgICAgIC8vIEl0ZXJhdGUgb3ZlciBlYWNoIGNodW5rXG4gICAgICAgIGNvbnN0IHBpcGVDaHVuayA9IGFzeW5jIGZ1bmN0aW9uKG51bWJlcjogbnVtYmVyKSB7XG4gICAgICAgICAgICBjb25zdCBjaHVua0ZpbGVuYW1lID0gbWUuZ2V0Q2h1bmtGaWxlbmFtZShudW1iZXIsIGlkZW50aWZpZXIpO1xuICAgICAgICAgICAgY29uc3QgZXhpc3RzID0gYXdhaXQgbWUuaXNGaWxlRXhpc3QoY2h1bmtGaWxlbmFtZSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIGNodW5rIHdpdGggdGhlIGN1cnJlbnQgbnVtYmVyIGV4aXN0cyxcbiAgICAgICAgICAgICAgICAvLyB0aGVuIGNyZWF0ZSBhIFJlYWRTdHJlYW0gZnJvbSB0aGUgZmlsZVxuICAgICAgICAgICAgICAgIC8vIGFuZCBwaXBlIGl0IHRvIHRoZSBzcGVjaWZpZWQgd3JpdGFibGVTdHJlYW0uXG4gICAgICAgICAgICAgICAgYXdhaXQgc3RyZWFtQ2h1bmsoY2h1bmtGaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgLy8gV2hlbiB0aGUgY2h1bmsgaXMgZnVsbHkgc3RyZWFtZWQsXG4gICAgICAgICAgICAgICAgLy8ganVtcCB0byB0aGUgbmV4dCBvbmVcbiAgICAgICAgICAgICAgICBhd2FpdCBwaXBlQ2h1bmsobnVtYmVyICsgMSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFdoZW4gYWxsIHRoZSBjaHVua3MgaGF2ZSBiZWVuIHBpcGVkLCBlbmQgdGhlIHN0cmVhbVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmVuZCkgd3JpdGFibGVTdHJlYW0uZW5kKCk7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMub25Eb25lKSBvcHRpb25zLm9uRG9uZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IHN0cmVhbUNodW5rID0gZnVuY3Rpb24oY2h1bmtGaWxlbmFtZTogc3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzb3VyY2VTdHJlYW0gPSBmcy5jcmVhdGVSZWFkU3RyZWFtKGNodW5rRmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIHNvdXJjZVN0cmVhbS5waXBlKHdyaXRhYmxlU3RyZWFtLCB7XG4gICAgICAgICAgICAgICAgICAgIGVuZDogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzb3VyY2VTdHJlYW0ub24oJ2VuZCcsIGFzeW5jIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3Qgd2FpdEZvcldyaXRlU3RyZWFtVG9PcGVuID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICB3cml0YWJsZVN0cmVhbS5vbignb3BlbicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIGF3YWl0IHdhaXRGb3JXcml0ZVN0cmVhbVRvT3BlbigpO1xuICAgICAgICBhd2FpdCBwaXBlQ2h1bmsoMSk7XG4gICAgfVxuXG5cbiAgICBhc3luYyBjbGVhbihpZGVudGlmaWVyOiBzdHJpbmcpIHtcbiAgICAgICAgLy8gSXRlcmF0ZSBvdmVyIGVhY2ggY2h1bmtcbiAgICAgICAgY29uc3QgbWUgPSB0aGlzO1xuICAgICAgICBjb25zdCBwaXBlQ2h1bmtSbSA9IGFzeW5jIGZ1bmN0aW9uIChudW1iZXI6IG51bWJlcikge1xuICAgICAgICAgICAgY29uc3QgY2h1bmtGaWxlbmFtZSA9IG1lLmdldENodW5rRmlsZW5hbWUobnVtYmVyLCBpZGVudGlmaWVyKTtcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0cyA9IGF3YWl0IG1lLmlzRmlsZUV4aXN0KGNodW5rRmlsZW5hbWUpO1xuICAgICAgICAgICAgaWYgKGV4aXN0cykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGZzLnVubGluayhjaHVua0ZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgdW5saW5rIGVycm9yIGluIGNsZWFuIC1yZXN1bWFibGUgJHtlfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBhd2FpdCBwaXBlQ2h1bmtSbShudW1iZXIgKyAxKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gYXdhaXQgcGlwZUNodW5rUm0oMSk7XG4gICAgfVxufSJdfQ==
