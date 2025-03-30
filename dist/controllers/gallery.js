"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports._processImage = exports._processVideo = exports.linkUpload = exports.checkUpload = exports.resumableUpload = exports.getMediaId = exports.getRoundImages = exports._writeFile = exports._calculateThumbnail = exports._upload = exports._uploadDoc = exports.uploadEdit = exports.upload = void 0;
const Event_1 = require("../models/Event");
const Media_1 = require("../models/Media");
const fs = require("fs-extra");
const sharp = require("sharp");
const Registration_1 = require("../models/Registration");
const Slack_1 = require("../common/Slack");
const ArtistWiseImages_1 = require("../common/ArtistWiseImages");
const logger_1 = require("../config/logger");
const eventRoundIncrementV2_1 = require("../common/eventRoundIncrementV2");
const Resumable_1 = require("../common/Resumable");
const mime = require("mime-types");
const fileType = require("file-type");
const Lot_1 = require("../models/Lot");
const imageExtensions = ['jpg', 'jpeg', 'png'];
// qt=mov
const videoExtensions = ['mov', 'mp4', 'mpg', 'avi', 'flv', 'wmv', 'tif', 'qt'];
const resumable = new Resumable_1.Resumable();
const dims = {
    compressed: {
        width: 1366
    },
    thumbnail: {
        width: 280,
        height: 440
    }
};
async function upload(req, res, next) {
    try {
        const media = await _uploadDoc(req, req.params.hash, req.params.eventId, parseInt(req.params.roundNo), req.params.contestantId, req.body.rawImage, false);
        const operationResult = {
            Success: true,
            Data: media
        };
        await res.json(operationResult);
    }
    catch (e) {
        e.status = 500;
        next(e);
    }
}
exports.upload = upload;
async function uploadEdit(req, res, next) {
    try {
        const media = await _uploadDoc(req, req.user, req.params.eventId, parseInt(req.params.roundNo), req.params.contestantId, req.body.rawImage, true, req.params.index);
        const operationResult = {
            Success: true,
            Data: media
        };
        await res.json(operationResult);
    }
    catch (e) {
        e.status = 500;
        next(e);
    }
}
exports.uploadEdit = uploadEdit;
async function _uploadDoc(req, hash, eventId, roundNo, contestantId, rawImage, edit, ImageMediaIndex, mediaId, VideoMediaIndex) {
    let registration;
    let totalContestantsInRound = 0;
    let totalImagesInRound = 0;
    if (!edit) {
        const regResults = await Promise.all([
            Event_1.default.findOne({ _id: eventId }).select(['RegistrationsVoteFactor']).sort({ _id: -1 }),
            Registration_1.default.findOne({ Hash: hash })
        ]);
        const registrationVoteFactors = regResults[0].RegistrationsVoteFactor;
        let registrationLog;
        for (let i = 0; i < registrationVoteFactors.length; i++) {
            if (registrationVoteFactors[i].Hash === hash &&
                (registrationVoteFactors[i].Status.toLowerCase() === 'admin' ||
                    registrationVoteFactors[i].Status.toLowerCase() === 'photo')) {
                registrationLog = registrationVoteFactors[i];
            }
        }
        registration = regResults[1];
        const isAllowedUpload = registrationLog && (registrationLog.Status.toLowerCase() === 'photo'
            || registrationLog.Status.toLowerCase() === 'admin');
        if (!(registrationLog && (registrationLog.Status && isAllowedUpload) && registration)) {
            // user is not eligible to upload
            throw {
                status: 403,
                message: 'You are not allowed to capture the image'
            };
        }
    }
    else if (typeof hash === 'object') {
        registration = hash;
    }
    // user is eligible to upload
    const event = await Event_1.default.findById(eventId)
        .populate('Rounds.Contestants.Detail');
    // .populate('Rounds.Contestants');
    let EaselNumber = 0;
    let ArtistName = '';
    let media;
    if (!mediaId) {
        media = new Media_1.default();
        media.UploadStart = new Date();
    }
    else {
        media = await Media_1.default.findById(mediaId);
    }
    if (edit) {
        media.Type = 'edited';
    }
    else {
        media.Type = 'original';
        await media.save();
    }
    const RoundNumber = roundNo;
    let RoundIndex = 0;
    let ArtistIndex = 0;
    let existingImageMediaObj;
    let existingVideoMediaObj;
    let Lot;
    for (let i = 0; i < event.Rounds.length; i++) {
        if (event.Rounds[i].RoundNumber == RoundNumber) {
            for (let j = 0; j < event.Rounds[i].Contestants.length; j++) {
                if (event.Rounds[i].Contestants[j]._id == contestantId) {
                    EaselNumber = event.Rounds[i].Contestants[j].EaselNumber;
                    ArtistName = event.Rounds[i].Contestants[j].Detail.Name.replace(/[\W_]+/g, '');
                    ArtistIndex = j;
                    if (ImageMediaIndex) {
                        existingImageMediaObj = event.Rounds[i].Contestants[j].Images[ImageMediaIndex];
                    }
                    else if (VideoMediaIndex) {
                        existingVideoMediaObj = event.Rounds[i].Contestants[j].Videos[VideoMediaIndex];
                    }
                    // break;
                    Lot = await Lot_1.default.findById(event.Rounds[i].Contestants[j].Lot._id);
                }
                if (event.Rounds[i].Contestants[j].Images.length > 0) {
                    totalImagesInRound++;
                }
                if (event.Rounds[i].Contestants[j].Videos.length > 0) {
                    totalImagesInRound++;
                }
                if (event.Rounds[i].Contestants[j].Enabled && event.Rounds[i].Contestants[j].EaselNumber > 0) {
                    totalContestantsInRound++;
                }
            }
            RoundIndex = i;
            break;
        }
    }
    logger_1.default.info(`EaselNumber ${EaselNumber}, 'ArtistName', ${ArtistName}, 'existingMediaObj ${JSON.stringify(existingImageMediaObj, null, 3)}`);
    if (EaselNumber > 0) {
        const fileName = `${event.Name.replace(/[\W_]+/g, '')}-${RoundNumber}-${EaselNumber}-${ArtistName}-${media.id}`;
        const compressedPath = `${fileName}-${dims.compressed.width}`;
        const thumbnailPath = `${fileName}-${dims.thumbnail.width}x${dims.thumbnail.height}`;
        const originalPath = `${fileName}`;
        const result = await _upload(rawImage, originalPath, thumbnailPath, compressedPath, edit, !!mediaId);
        media.UploadFinish = result.mainEnd;
        /*Save media in the event*/
        const mediaInEvent = {
            'ArtId': `${event.EID}-${RoundNumber}-${EaselNumber}`,
            'Edited': undefined,
            'Original': undefined
        };
        if (result.isImage) {
            media.FileType = 'image';
            let thumbnailModel;
            let compressedModel;
            if (!edit) {
                thumbnailModel = new Media_1.default();
                compressedModel = new Media_1.default();
            }
            else {
                compressedModel = await Media_1.default.findById(existingImageMediaObj.Compressed.id);
                thumbnailModel = await Media_1.default.findById(existingImageMediaObj.Thumbnail.id);
            }
            /* save thumbnail */
            thumbnailModel.ResizeStart = result.thumbStart;
            thumbnailModel.ResizeEnd = result.thumbEnd;
            thumbnailModel.Name = fileName;
            thumbnailModel.Url = result.thumb;
            thumbnailModel.Dimension = {
                width: result.thumbWidth,
                height: result.thumbHeight
            };
            thumbnailModel.Size = result.thumbSize;
            thumbnailModel.UploadedBy = registration._id;
            thumbnailModel.Type = 'Thumb';
            await thumbnailModel.save();
            /* save compressed */
            compressedModel.ResizeStart = result.compressionStart;
            compressedModel.ResizeEnd = result.compressionEnd;
            compressedModel.Name = fileName;
            compressedModel.Url = result.compressed;
            compressedModel.Dimension = {
                width: result.compressedWidth,
                height: result.compressedHeight
            };
            compressedModel.Size = result.compressedSize;
            compressedModel.UploadedBy = registration._id;
            compressedModel.Type = 'Optimized';
            await compressedModel.save();
            media.Thumbnails.push(thumbnailModel._id);
            media.Optimized = compressedModel._id;
            mediaInEvent.Thumbnail = {
                url: thumbnailModel.Url,
                id: thumbnailModel.id
            };
            mediaInEvent.Compressed = {
                url: compressedModel.Url,
                id: compressedModel.id
            };
        }
        else {
            media.FileType = 'video';
        }
        /*save main*/
        media.Name = fileName;
        media.Url = result.main;
        media.Dimension = {
            width: result.mainWidth,
            height: result.mainHeight
        };
        media.Size = result.mainSize;
        media.UploadedBy = registration._id;
        const savedMedia = await media.save();
        console.log('Lot', Lot.Status);
        if (Lot && Lot.Status === 0) {
            logger_1.default.info(`auto opening auction on image upload ${Lot.ArtId}`);
            Lot.Status = 1;
            event.Rounds[RoundIndex].Contestants[ArtistIndex].EnableAuction = 1;
            await Lot.save();
        }
        /*Follow/Following Start
        if (media.FileType === 'image' && Lot.Images.indexOf(media._id.toString()) === -1) {
            Lot.Images.push(savedMedia._id);
            await Lot.save();
        } else if (media.FileType === 'video' && Lot.Videos.indexOf(media._id.toString()) === -1) {
            Lot.Videos.push(savedMedia._id);
            await Lot.save();
        }
        Follow/Following end*/
        if (!edit) {
            mediaInEvent.Original = {
                url: media.Url,
                id: media.id
            };
            if (result.isImage) {
                event.Rounds[RoundIndex].Contestants[ArtistIndex].Images.push(mediaInEvent);
            }
            else {
                // video link
                event.Rounds[RoundIndex].Contestants[ArtistIndex].Videos.push(mediaInEvent);
            }
        }
        else {
            mediaInEvent.Edited = {
                url: media.Url,
                id: media.id
            };
            mediaInEvent.Original = event.Rounds[RoundIndex].Contestants[ArtistIndex].Images[ImageMediaIndex].Original;
            if (result.isImage) {
                event.Rounds[RoundIndex].Contestants[ArtistIndex].Images[ImageMediaIndex] = mediaInEvent;
            }
            else {
                // video link
                event.Rounds[RoundIndex].Contestants[ArtistIndex].Videos[VideoMediaIndex] = mediaInEvent;
            }
        }
        await event.save();
        const cacheDel = req.app.get('cacheDel');
        const artId = mediaInEvent.ArtId;
        logger_1.default.info(`removing auction-detail-${artId} due to upload`);
        const delRes = await cacheDel(`auction-detail-${artId}`);
        logger_1.default.info(`removed auction-detail-${artId}  due to upload, ${JSON.stringify(delRes, null, 2)}`);
        await cacheDel(`auction-detail-${artId}`);
        let slackMessage;
        if (!edit) {
            slackMessage = `${registration.DisplayPhone} uploaded a ${media.FileType} for
            ${event.Name.replace(/[\\W_]+/g, '')}-${RoundNumber}-${EaselNumber}-${ArtistName} - ${mediaInEvent.Original.url}`;
            // TODO open auction if not open already
        }
        else {
            slackMessage = `${registration.DisplayPhone} edited a ${media.FileType} for
            ${event.Name.replace(/[\\W_]+/g, '')}-${RoundNumber}-${EaselNumber}-${ArtistName} - ${mediaInEvent.Edited.url}`;
        }
        Slack_1.default({
            'text': slackMessage
        }).catch(() => logger_1.default.info('upload slack call failed'));
        if (totalImagesInRound >= totalContestantsInRound) {
            await eventRoundIncrementV2_1.EventIncrementRoundV2(req, event._id, registration._id, roundNo);
        }
        mediaInEvent.FileType = media.FileType && media.FileType.toString();
        return mediaInEvent;
    }
    else {
        throw {
            status: 403,
            message: 'Invalid parameters passed'
        };
    }
}
exports._uploadDoc = _uploadDoc;
async function _upload(rawImage, originalPath, thumbnailPath, compressedPath, edit, isPath) {
    let imgBuffer;
    let filePath;
    filePath = `${__dirname}/../public/uploads/images/originals/${originalPath}`;
    if (!isPath) {
        const base64Data = rawImage.replace(/^data:image\/([\w+]+);base64/, '');
        imgBuffer = Buffer.from(base64Data, 'base64');
    }
    else {
        imgBuffer = await fs.readFile(rawImage);
        filePath = rawImage;
    }
    const fType = fileType(imgBuffer);
    const isImage = imageExtensions.indexOf(fType.ext) > -1;
    const isVideo = videoExtensions.indexOf(fType.ext) > -1;
    if (isImage) {
        return _processImage(filePath, originalPath, thumbnailPath, compressedPath, imgBuffer, isPath, edit);
    }
    else if (isVideo) {
        return _processVideo(filePath, originalPath, thumbnailPath, compressedPath, imgBuffer, isPath);
    }
    else {
        throw new Error(`Unsupported File ${fType.ext}`);
    }
}
exports._upload = _upload;
async function _calculateThumbnail(binary, thumbnailPath, width, height) {
    const startDate = new Date();
    const file = `${thumbnailPath}.jpg`;
    // 108, 170 -> 150 x 236
    const result = await sharp(binary).rotate().resize(width, height).jpeg({
        quality: 50,
        chromaSubsampling: '4:4:4',
    }).toFile(file);
    const endDate = new Date();
    return {
        startDate: startDate,
        endDate: endDate,
        height: result.height,
        width: result.width,
        size: result.size,
        file: file
    };
}
exports._calculateThumbnail = _calculateThumbnail;
async function _writeFile(filePath, binary, isPath) {
    const startDate = new Date();
    const imageMeta = await sharp(binary).metadata();
    const file = `${filePath}.${imageMeta.format}`;
    if (!isPath) {
        await fs.writeFile(file, binary);
    }
    const endDate = new Date();
    return {
        startDate: startDate,
        endDate: endDate,
        height: imageMeta.height,
        width: imageMeta.width,
        size: imageMeta.size,
        file: isPath ? filePath : file
    };
}
exports._writeFile = _writeFile;
async function getRoundImages(req, res, next) {
    const eventId = req.params.eventId;
    const roundNumber = parseInt(req.params.roundNo);
    const event = await Event_1.default.findById(eventId)
        .select(['Rounds', 'CurrentRound', 'EID', 'EnableAuction'])
        .populate('Rounds.Contestants.Detail');
    if (!event) {
        next({
            status: 403,
            message: `Invalid event Id ${eventId}`
        });
        return;
    }
    const currentRound = event.CurrentRound && event.CurrentRound.RoundNumber;
    for (let j = 0; j < event.Rounds.length; j++) {
        if (event.Rounds[j].RoundNumber === roundNumber) {
            const artistImages = ArtistWiseImages_1.default(event.Rounds[j].Contestants);
            const response = {
                EventId: eventId,
                RoundNumber: roundNumber,
                Artists: artistImages.artists,
                IsCurrentRound: currentRound === roundNumber,
                HasOpenRound: !event.Rounds[j].IsFinished,
                HasImages: artistImages.hasImages,
                EID: event.EID || '',
                EnableAuction: event.EnableAuction
            };
            const operationResult = {
                Success: true,
                Data: response
            };
            res.json(operationResult);
            return;
        }
    }
    next({
        status: 403,
        message: `No matching round ${roundNumber} found in ${eventId}`
    });
}
exports.getRoundImages = getRoundImages;
async function getMediaId(req, res, next) {
    try {
        const registration = await Registration_1.default.findOne({
            Hash: req.params.hash
        });
        if (!registration) {
            res.status(403);
            res.json({
                Message: `Invalid user hash ${req.params.hash}`
            });
            return;
        }
        const baseIdObj = req.body;
        const fileExtension = mime.extension(baseIdObj.fileType);
        if (!fileExtension) {
            next({
                status: 400,
                message: `Unsupported file type ${baseIdObj.fileType}`
            });
            return;
        }
        let fileType;
        if (imageExtensions.indexOf(fileExtension) > -1) {
            fileType = 'photo';
        }
        else if (videoExtensions.indexOf(fileExtension) > -1) {
            fileType = 'video';
        }
        if (!fileExtension) {
            next({
                status: 400,
                message: `Unsupported file type ${fileExtension}`
            });
            return;
        }
        const media = new Media_1.default({
            Size: 0,
            UploadedBy: registration._id,
            Type: 'original',
            UploadStart: new Date(),
            FileType: fileType
        });
        const savedMedia = await media.save();
        baseIdObj.id = `${baseIdObj.prefixId}-${savedMedia._id}`;
        baseIdObj.MediaId = savedMedia._id;
        savedMedia.Name = `${req.params.baseIdJson}-${media._id}`;
        baseIdObj.fileType = media.FileType;
        await savedMedia.save();
        logger_1.default.info(`baseIdObj ${JSON.stringify(baseIdObj)}`);
        res.json(baseIdObj);
    }
    catch (e) {
        next(e);
    }
}
exports.getMediaId = getMediaId;
async function resumableUpload(req, res, next) {
    try {
        const { validation, outputFileName } = await resumable.post(req);
        if (validation === 'done') {
            res.json({ status: validation, outputFileName: outputFileName });
        }
        else {
            res.json({ status: validation });
        }
    }
    catch (e) {
        console.error(e);
        next(e);
    }
}
exports.resumableUpload = resumableUpload;
async function checkUpload(req, res, next) {
    try {
        const { status } = await resumable.get(req);
        res.status(status ? 200 : 404);
        res.json(status);
    }
    catch (e) {
        next(e);
    }
}
exports.checkUpload = checkUpload;
async function linkUpload(req, res, next) {
    try {
        const body = req.body;
        body.mediaInEvent = await _uploadDoc(req, body.hash, body.eventId, body.roundNumber, body.contestantId, body.outputFileName, false, null, body.MediaId);
        res.json(body);
    }
    catch (e) {
        next(e);
    }
}
exports.linkUpload = linkUpload;
async function _processVideo(filePath, originalPath, thumbnailPath, compressedPath, imgBuffer, isPath) {
    return {
        main: `${process.env.MEDIA_SITE_URL}${filePath.substr(filePath.indexOf('public') + 'public'.length)}`,
        mainStart: new Date(),
        mainEnd: new Date(),
        mainHeight: 0,
        mainWidth: 0,
        mainSize: 0,
        mainFile: filePath,
        isImage: false,
        isVideo: true
    };
}
exports._processVideo = _processVideo;
async function _processImage(filePath, originalPath, thumbnailPath, compressedPath, imgBuffer, isPath, edit) {
    if (edit) {
        filePath = `${__dirname}/../public/uploads/images/edited/${originalPath}`;
    }
    const thumbPath = `${__dirname}/../public/uploads/images/thumbnails/${thumbnailPath}`;
    const optimizedPath = `${__dirname}/../public/uploads/images/compressed/${compressedPath}`;
    const result = await Promise.all([
        _writeFile(filePath, imgBuffer, isPath),
        _calculateThumbnail(imgBuffer, thumbPath, dims.thumbnail.width, dims.thumbnail.height),
        _calculateThumbnail(imgBuffer, optimizedPath, dims.compressed.width)
    ]);
    return {
        main: `${process.env.MEDIA_SITE_URL}${result[0].file.substr(result[0].file.indexOf('public') + 'public'.length)}`,
        mainStart: result[0].startDate,
        mainEnd: result[0].endDate,
        mainHeight: result[0].height,
        mainWidth: result[0].width,
        mainSize: result[0].size,
        mainFile: result[0].file,
        thumb: `${process.env.MEDIA_SITE_URL}${result[1].file.substr(result[1].file.indexOf('public') + 'public'.length)}`,
        thumbStart: result[1].startDate,
        thumbEnd: result[1].endDate,
        thumbHeight: result[1].height,
        thumbWidth: result[1].width,
        thumbSize: result[1].size,
        thumbFile: result[1].file,
        compressed: `${process.env.MEDIA_SITE_URL}${result[2].file.substr(result[2].file.indexOf('public') + 'public'.length)}`,
        compressionStart: result[2].startDate,
        compressionEnd: result[2].endDate,
        compressedHeight: result[2].height,
        compressedWidth: result[2].width,
        compressedSize: result[2].size,
        compressedFile: result[2].file,
        isImage: true,
        isVideo: false
    };
}
exports._processImage = _processImage;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFRLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUU7UUFDdkgsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7UUFDckMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPO1FBQ2pDLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNO1FBQ2xDLGVBQWUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSztRQUNoQyxjQUFjLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUk7UUFDOUIsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJO1FBQzlCLE9BQU8sRUFBRSxJQUFJO1FBQ2IsT0FBTyxFQUFFLEtBQUs7S0FDakIsQ0FBQztBQUNOLENBQUM7QUFyQ0Qsc0NBcUNDIiwiZmlsZSI6ImNvbnRyb2xsZXJzL2dhbGxlcnkuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgeyBkZWZhdWx0IGFzIEV2ZW50TW9kZWwgfSBmcm9tICcuLi9tb2RlbHMvRXZlbnQnO1xuaW1wb3J0IE1lZGlhTW9kZWwsIHsgTWVkaWFEb2N1bWVudCB9IGZyb20gJy4uL21vZGVscy9NZWRpYSc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy1leHRyYSc7XG5pbXBvcnQgKiBhcyBzaGFycCBmcm9tICdzaGFycCc7XG5pbXBvcnQgUmVnaXN0cmF0aW9uTW9kZWwgZnJvbSAnLi4vbW9kZWxzL1JlZ2lzdHJhdGlvbic7XG5pbXBvcnQgeyBEYXRhT3BlcmF0aW9uUmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL09wZXJhdGlvblJlc3VsdCc7XG5pbXBvcnQgeyBBcnRpc3RJbmRpdmlkdWFsSW1hZ2UgfSBmcm9tICcuLi8uLi8uLi9zaGFyZWQvUm91bmRDb250ZXN0YW50RFRPJztcbmltcG9ydCBwb3N0VG9TbGFjayBmcm9tICcuLi9jb21tb24vU2xhY2snO1xuaW1wb3J0IGFydGlzdFdpc2VJbWFnZXMgZnJvbSAnLi4vY29tbW9uL0FydGlzdFdpc2VJbWFnZXMnO1xuaW1wb3J0IHsgUm91bmRBcnRpc3RzSW50ZXJmYWNlIH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL0FydGlzdEltYWdlRFRPJztcbmltcG9ydCBsb2dnZXIgZnJvbSAnLi4vY29uZmlnL2xvZ2dlcic7XG5pbXBvcnQgUmVnaXN0cmF0aW9uRFRPIGZyb20gJy4uLy4uLy4uL3NoYXJlZC9SZWdpc3RyYXRpb25EVE8nO1xuaW1wb3J0IHsgRXZlbnRJbmNyZW1lbnRSb3VuZFYyIH0gZnJvbSAnLi4vY29tbW9uL2V2ZW50Um91bmRJbmNyZW1lbnRWMic7XG5pbXBvcnQgeyBSZXN1bWFibGUgfSBmcm9tICcuLi9jb21tb24vUmVzdW1hYmxlJztcbmltcG9ydCAqIGFzIG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZmlsZVR5cGUgPSByZXF1aXJlKCdmaWxlLXR5cGUnKTtcbmltcG9ydCBMb3RNb2RlbCwgeyBMb3REb2N1bWVudCB9IGZyb20gJy4uL21vZGVscy9Mb3QnO1xuXG5jb25zdCBpbWFnZUV4dGVuc2lvbnMgPSBbJ2pwZycsICdqcGVnJywgJ3BuZyddO1xuLy8gcXQ9bW92XG5jb25zdCB2aWRlb0V4dGVuc2lvbnMgPSBbJ21vdicsICdtcDQnLCAnbXBnJywgJ2F2aScsICdmbHYnLCAnd212JywgJ3RpZicsICdxdCddO1xuXG5jb25zdCByZXN1bWFibGUgPSBuZXcgUmVzdW1hYmxlKCk7XG5jb25zdCBkaW1zID0ge1xuICAgIGNvbXByZXNzZWQ6IHtcbiAgICAgICAgd2lkdGg6IDEzNjZcbiAgICB9LFxuICAgIHRodW1ibmFpbDoge1xuICAgICAgICB3aWR0aDogMjgwLFxuICAgICAgICBoZWlnaHQ6IDQ0MFxuICAgIH1cbn07XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB1cGxvYWQocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBtZWRpYSA9IGF3YWl0IF91cGxvYWREb2MocmVxLCByZXEucGFyYW1zLmhhc2gsIHJlcS5wYXJhbXMuZXZlbnRJZCwgcGFyc2VJbnQocmVxLnBhcmFtcy5yb3VuZE5vKSxcbiAgICAgICAgICAgIHJlcS5wYXJhbXMuY29udGVzdGFudElkLCByZXEuYm9keS5yYXdJbWFnZSwgZmFsc2UpO1xuICAgICAgICBjb25zdCBvcGVyYXRpb25SZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8QXJ0aXN0SW5kaXZpZHVhbEltYWdlPiA9IHtcbiAgICAgICAgICAgIFN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICBEYXRhOiBtZWRpYVxuICAgICAgICB9O1xuICAgICAgICBhd2FpdCByZXMuanNvbihvcGVyYXRpb25SZXN1bHQpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgZS5zdGF0dXMgPSA1MDA7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBsb2FkRWRpdChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IG1lZGlhID0gYXdhaXQgX3VwbG9hZERvYyhyZXEsIHJlcS51c2VyLCByZXEucGFyYW1zLmV2ZW50SWQsIHBhcnNlSW50KHJlcS5wYXJhbXMucm91bmRObyksXG4gICAgICAgICAgICByZXEucGFyYW1zLmNvbnRlc3RhbnRJZCwgcmVxLmJvZHkucmF3SW1hZ2UsIHRydWUsIHJlcS5wYXJhbXMuaW5kZXgpO1xuICAgICAgICBjb25zdCBvcGVyYXRpb25SZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8QXJ0aXN0SW5kaXZpZHVhbEltYWdlPiA9IHtcbiAgICAgICAgICAgIFN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICBEYXRhOiBtZWRpYVxuICAgICAgICB9O1xuICAgICAgICBhd2FpdCByZXMuanNvbihvcGVyYXRpb25SZXN1bHQpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgZS5zdGF0dXMgPSA1MDA7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gX3VwbG9hZERvYyhyZXE6IFJlcXVlc3QsIGhhc2g6IChzdHJpbmcgfCBSZWdpc3RyYXRpb25EVE8pLCBldmVudElkOiBhbnksIHJvdW5kTm86IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlc3RhbnRJZDogYW55LCByYXdJbWFnZTogc3RyaW5nLCBlZGl0PzogYm9vbGVhbiwgSW1hZ2VNZWRpYUluZGV4PzogbnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVkaWFJZD86IGFueSwgVmlkZW9NZWRpYUluZGV4PzogbnVtYmVyKSB7XG4gICAgbGV0IHJlZ2lzdHJhdGlvbjogUmVnaXN0cmF0aW9uRFRPO1xuICAgIGxldCB0b3RhbENvbnRlc3RhbnRzSW5Sb3VuZCA9IDA7XG4gICAgbGV0IHRvdGFsSW1hZ2VzSW5Sb3VuZCA9IDA7XG4gICAgaWYgKCFlZGl0KSB7XG4gICAgICAgIGNvbnN0IHJlZ1Jlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICBFdmVudE1vZGVsLmZpbmRPbmUoe19pZDogZXZlbnRJZH0pLnNlbGVjdChbJ1JlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yJ10pLnNvcnQoe19pZDogLTF9KSxcbiAgICAgICAgICAgIFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmRPbmUoe0hhc2g6IGhhc2h9KVxuICAgICAgICBdKTtcbiAgICAgICAgY29uc3QgcmVnaXN0cmF0aW9uVm90ZUZhY3RvcnMgPSByZWdSZXN1bHRzWzBdLlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yO1xuICAgICAgICBsZXQgcmVnaXN0cmF0aW9uTG9nO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlZ2lzdHJhdGlvblZvdGVGYWN0b3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAocmVnaXN0cmF0aW9uVm90ZUZhY3RvcnNbaV0uSGFzaCA9PT0gaGFzaCAmJlxuICAgICAgICAgICAgICAgIChyZWdpc3RyYXRpb25Wb3RlRmFjdG9yc1tpXS5TdGF0dXMudG9Mb3dlckNhc2UoKSA9PT0gJ2FkbWluJyB8fFxuICAgICAgICAgICAgICAgICAgICByZWdpc3RyYXRpb25Wb3RlRmFjdG9yc1tpXS5TdGF0dXMudG9Mb3dlckNhc2UoKSA9PT0gJ3Bob3RvJykpIHtcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb25Mb2cgPSByZWdpc3RyYXRpb25Wb3RlRmFjdG9yc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZWdpc3RyYXRpb24gPSByZWdSZXN1bHRzWzFdO1xuICAgICAgICBjb25zdCBpc0FsbG93ZWRVcGxvYWQgPSByZWdpc3RyYXRpb25Mb2cgJiYgKHJlZ2lzdHJhdGlvbkxvZy5TdGF0dXMudG9Mb3dlckNhc2UoKSA9PT0gJ3Bob3RvJ1xuICAgICAgICAgICAgfHwgcmVnaXN0cmF0aW9uTG9nLlN0YXR1cy50b0xvd2VyQ2FzZSgpID09PSAnYWRtaW4nKTtcbiAgICAgICAgaWYgKCEocmVnaXN0cmF0aW9uTG9nICYmIChyZWdpc3RyYXRpb25Mb2cuU3RhdHVzICYmIGlzQWxsb3dlZFVwbG9hZCkgJiYgcmVnaXN0cmF0aW9uKSkge1xuICAgICAgICAgICAgLy8gdXNlciBpcyBub3QgZWxpZ2libGUgdG8gdXBsb2FkXG4gICAgICAgICAgICB0aHJvdyB7XG4gICAgICAgICAgICAgICAgc3RhdHVzOiA0MDMsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1lvdSBhcmUgbm90IGFsbG93ZWQgdG8gY2FwdHVyZSB0aGUgaW1hZ2UnXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgaGFzaCA9PT0gICdvYmplY3QnKSB7XG4gICAgICAgIHJlZ2lzdHJhdGlvbiA9IGhhc2g7XG4gICAgfVxuICAgIC8vIHVzZXIgaXMgZWxpZ2libGUgdG8gdXBsb2FkXG4gICAgY29uc3QgZXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsLmZpbmRCeUlkKGV2ZW50SWQpXG4gICAgICAgIC5wb3B1bGF0ZSgnUm91bmRzLkNvbnRlc3RhbnRzLkRldGFpbCcpO1xuICAgIC8vIC5wb3B1bGF0ZSgnUm91bmRzLkNvbnRlc3RhbnRzJyk7XG4gICAgbGV0IEVhc2VsTnVtYmVyID0gMDtcbiAgICBsZXQgQXJ0aXN0TmFtZSA9ICcnO1xuICAgIGxldCBtZWRpYTogTWVkaWFEb2N1bWVudDtcbiAgICBpZiAoIW1lZGlhSWQpIHtcbiAgICAgICAgbWVkaWEgPSBuZXcgTWVkaWFNb2RlbCgpO1xuICAgICAgICBtZWRpYS5VcGxvYWRTdGFydCA9IG5ldyBEYXRlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWVkaWEgPSBhd2FpdCBNZWRpYU1vZGVsLmZpbmRCeUlkKG1lZGlhSWQpO1xuICAgIH1cbiAgICBpZiAoZWRpdCkge1xuICAgICAgICBtZWRpYS5UeXBlID0gJ2VkaXRlZCc7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWVkaWEuVHlwZSA9ICdvcmlnaW5hbCc7XG4gICAgICAgIGF3YWl0IG1lZGlhLnNhdmUoKTtcbiAgICB9XG5cbiAgICBjb25zdCBSb3VuZE51bWJlciA9IHJvdW5kTm87XG4gICAgbGV0IFJvdW5kSW5kZXggPSAwO1xuICAgIGxldCBBcnRpc3RJbmRleCA9IDA7XG4gICAgbGV0IGV4aXN0aW5nSW1hZ2VNZWRpYU9iajtcbiAgICBsZXQgZXhpc3RpbmdWaWRlb01lZGlhT2JqO1xuICAgIGxldCBMb3Q6IExvdERvY3VtZW50O1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXZlbnQuUm91bmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChldmVudC5Sb3VuZHNbaV0uUm91bmROdW1iZXIgPT0gUm91bmROdW1iZXIpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZXZlbnQuUm91bmRzW2ldLkNvbnRlc3RhbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50LlJvdW5kc1tpXS5Db250ZXN0YW50c1tqXS5faWQgPT0gY29udGVzdGFudElkKSB7XG4gICAgICAgICAgICAgICAgICAgIEVhc2VsTnVtYmVyID0gZXZlbnQuUm91bmRzW2ldLkNvbnRlc3RhbnRzW2pdLkVhc2VsTnVtYmVyO1xuICAgICAgICAgICAgICAgICAgICBBcnRpc3ROYW1lID0gZXZlbnQuUm91bmRzW2ldLkNvbnRlc3RhbnRzW2pdLkRldGFpbC5OYW1lLnJlcGxhY2UoL1tcXFdfXSsvZywgJycpO1xuICAgICAgICAgICAgICAgICAgICBBcnRpc3RJbmRleCA9IGo7XG4gICAgICAgICAgICAgICAgICAgIGlmIChJbWFnZU1lZGlhSW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4aXN0aW5nSW1hZ2VNZWRpYU9iaiA9IGV2ZW50LlJvdW5kc1tpXS5Db250ZXN0YW50c1tqXS5JbWFnZXNbSW1hZ2VNZWRpYUluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChWaWRlb01lZGlhSW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4aXN0aW5nVmlkZW9NZWRpYU9iaiA9IGV2ZW50LlJvdW5kc1tpXS5Db250ZXN0YW50c1tqXS5WaWRlb3NbVmlkZW9NZWRpYUluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgTG90ID0gYXdhaXQgTG90TW9kZWwuZmluZEJ5SWQoZXZlbnQuUm91bmRzW2ldLkNvbnRlc3RhbnRzW2pdLkxvdC5faWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoZXZlbnQuUm91bmRzW2ldLkNvbnRlc3RhbnRzW2pdLkltYWdlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsSW1hZ2VzSW5Sb3VuZCArKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50LlJvdW5kc1tpXS5Db250ZXN0YW50c1tqXS5WaWRlb3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICB0b3RhbEltYWdlc0luUm91bmQgKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChldmVudC5Sb3VuZHNbaV0uQ29udGVzdGFudHNbal0uRW5hYmxlZCAmJiBldmVudC5Sb3VuZHNbaV0uQ29udGVzdGFudHNbal0uRWFzZWxOdW1iZXIgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsQ29udGVzdGFudHNJblJvdW5kICsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFJvdW5kSW5kZXggPSBpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG4gICAgbG9nZ2VyLmluZm8oYEVhc2VsTnVtYmVyICR7RWFzZWxOdW1iZXJ9LCAnQXJ0aXN0TmFtZScsICR7QXJ0aXN0TmFtZX0sICdleGlzdGluZ01lZGlhT2JqICR7SlNPTi5zdHJpbmdpZnkoZXhpc3RpbmdJbWFnZU1lZGlhT2JqLCBudWxsLCAzKX1gKTtcbiAgICBpZiAoRWFzZWxOdW1iZXIgPiAwKSB7XG4gICAgICAgIGNvbnN0IGZpbGVOYW1lID0gYCR7ZXZlbnQuTmFtZS5yZXBsYWNlKC9bXFxXX10rL2csICcnKX0tJHtSb3VuZE51bWJlcn0tJHtFYXNlbE51bWJlcn0tJHtBcnRpc3ROYW1lfS0ke21lZGlhLmlkfWA7XG4gICAgICAgIGNvbnN0IGNvbXByZXNzZWRQYXRoID0gYCR7ZmlsZU5hbWV9LSR7ZGltcy5jb21wcmVzc2VkLndpZHRofWA7XG4gICAgICAgIGNvbnN0IHRodW1ibmFpbFBhdGggPSBgJHtmaWxlTmFtZX0tJHtkaW1zLnRodW1ibmFpbC53aWR0aH14JHtkaW1zLnRodW1ibmFpbC5oZWlnaHR9YDtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxQYXRoID0gYCR7ZmlsZU5hbWV9YDtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgX3VwbG9hZChyYXdJbWFnZSwgb3JpZ2luYWxQYXRoLCB0aHVtYm5haWxQYXRoLCBjb21wcmVzc2VkUGF0aCwgZWRpdCwgISFtZWRpYUlkKTtcbiAgICAgICAgbWVkaWEuVXBsb2FkRmluaXNoID0gcmVzdWx0Lm1haW5FbmQ7XG4gICAgICAgIC8qU2F2ZSBtZWRpYSBpbiB0aGUgZXZlbnQqL1xuICAgICAgICBjb25zdCBtZWRpYUluRXZlbnQ6IHtcbiAgICAgICAgICAgICdUaHVtYm5haWwnPzoge1xuICAgICAgICAgICAgICAgIHVybDogc3RyaW5nO1xuICAgICAgICAgICAgICAgIGlkOiBzdHJpbmc7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgJ0NvbXByZXNzZWQnPzoge1xuICAgICAgICAgICAgICAgIHVybDogc3RyaW5nO1xuICAgICAgICAgICAgICAgIGlkOiBzdHJpbmc7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgJ09yaWdpbmFsJzoge1xuICAgICAgICAgICAgICAgIHVybDogc3RyaW5nO1xuICAgICAgICAgICAgICAgIGlkOiBzdHJpbmc7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgJ0VkaXRlZCc6IHtcbiAgICAgICAgICAgICAgICB1cmw6IHN0cmluZztcbiAgICAgICAgICAgICAgICBpZDogc3RyaW5nO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIEFydElkOiBzdHJpbmc7XG4gICAgICAgICAgICBGaWxlVHlwZT86IHN0cmluZztcbiAgICAgICAgfSA9IHtcbiAgICAgICAgICAgICdBcnRJZCc6IGAke2V2ZW50LkVJRH0tJHtSb3VuZE51bWJlcn0tJHtFYXNlbE51bWJlcn1gLFxuICAgICAgICAgICAgJ0VkaXRlZCc6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICdPcmlnaW5hbCc6IHVuZGVmaW5lZFxuICAgICAgICB9O1xuICAgICAgICBpZiAocmVzdWx0LmlzSW1hZ2UpIHtcbiAgICAgICAgICAgIG1lZGlhLkZpbGVUeXBlID0gJ2ltYWdlJztcbiAgICAgICAgICAgIGxldCB0aHVtYm5haWxNb2RlbDtcbiAgICAgICAgICAgIGxldCBjb21wcmVzc2VkTW9kZWw7XG4gICAgICAgICAgICBpZiAoIWVkaXQpIHtcbiAgICAgICAgICAgICAgICB0aHVtYm5haWxNb2RlbCA9IG5ldyBNZWRpYU1vZGVsKCk7XG4gICAgICAgICAgICAgICAgY29tcHJlc3NlZE1vZGVsID0gbmV3IE1lZGlhTW9kZWwoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcHJlc3NlZE1vZGVsID0gYXdhaXQgTWVkaWFNb2RlbC5maW5kQnlJZChleGlzdGluZ0ltYWdlTWVkaWFPYmouQ29tcHJlc3NlZC5pZCk7XG4gICAgICAgICAgICAgICAgdGh1bWJuYWlsTW9kZWwgPSBhd2FpdCBNZWRpYU1vZGVsLmZpbmRCeUlkKGV4aXN0aW5nSW1hZ2VNZWRpYU9iai5UaHVtYm5haWwuaWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogc2F2ZSB0aHVtYm5haWwgKi9cbiAgICAgICAgICAgIHRodW1ibmFpbE1vZGVsLlJlc2l6ZVN0YXJ0ID0gcmVzdWx0LnRodW1iU3RhcnQ7XG4gICAgICAgICAgICB0aHVtYm5haWxNb2RlbC5SZXNpemVFbmQgPSByZXN1bHQudGh1bWJFbmQ7XG4gICAgICAgICAgICB0aHVtYm5haWxNb2RlbC5OYW1lID0gZmlsZU5hbWU7XG4gICAgICAgICAgICB0aHVtYm5haWxNb2RlbC5VcmwgPSByZXN1bHQudGh1bWI7XG4gICAgICAgICAgICB0aHVtYm5haWxNb2RlbC5EaW1lbnNpb24gPSB7XG4gICAgICAgICAgICAgICAgd2lkdGg6IHJlc3VsdC50aHVtYldpZHRoLFxuICAgICAgICAgICAgICAgIGhlaWdodDogcmVzdWx0LnRodW1iSGVpZ2h0XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGh1bWJuYWlsTW9kZWwuU2l6ZSA9IHJlc3VsdC50aHVtYlNpemU7XG4gICAgICAgICAgICB0aHVtYm5haWxNb2RlbC5VcGxvYWRlZEJ5ID0gcmVnaXN0cmF0aW9uLl9pZDtcbiAgICAgICAgICAgIHRodW1ibmFpbE1vZGVsLlR5cGUgPSAnVGh1bWInO1xuXG4gICAgICAgICAgICBhd2FpdCB0aHVtYm5haWxNb2RlbC5zYXZlKCk7XG5cbiAgICAgICAgICAgIC8qIHNhdmUgY29tcHJlc3NlZCAqL1xuXG4gICAgICAgICAgICBjb21wcmVzc2VkTW9kZWwuUmVzaXplU3RhcnQgPSByZXN1bHQuY29tcHJlc3Npb25TdGFydDtcbiAgICAgICAgICAgIGNvbXByZXNzZWRNb2RlbC5SZXNpemVFbmQgPSByZXN1bHQuY29tcHJlc3Npb25FbmQ7XG4gICAgICAgICAgICBjb21wcmVzc2VkTW9kZWwuTmFtZSA9IGZpbGVOYW1lO1xuICAgICAgICAgICAgY29tcHJlc3NlZE1vZGVsLlVybCA9IHJlc3VsdC5jb21wcmVzc2VkO1xuICAgICAgICAgICAgY29tcHJlc3NlZE1vZGVsLkRpbWVuc2lvbiA9IHtcbiAgICAgICAgICAgICAgICB3aWR0aDogcmVzdWx0LmNvbXByZXNzZWRXaWR0aCxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IHJlc3VsdC5jb21wcmVzc2VkSGVpZ2h0XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgY29tcHJlc3NlZE1vZGVsLlNpemUgPSByZXN1bHQuY29tcHJlc3NlZFNpemU7XG4gICAgICAgICAgICBjb21wcmVzc2VkTW9kZWwuVXBsb2FkZWRCeSA9IHJlZ2lzdHJhdGlvbi5faWQ7XG4gICAgICAgICAgICBjb21wcmVzc2VkTW9kZWwuVHlwZSA9ICdPcHRpbWl6ZWQnO1xuXG4gICAgICAgICAgICBhd2FpdCBjb21wcmVzc2VkTW9kZWwuc2F2ZSgpO1xuICAgICAgICAgICAgbWVkaWEuVGh1bWJuYWlscy5wdXNoKHRodW1ibmFpbE1vZGVsLl9pZCk7XG4gICAgICAgICAgICBtZWRpYS5PcHRpbWl6ZWQgPSBjb21wcmVzc2VkTW9kZWwuX2lkO1xuICAgICAgICAgICAgbWVkaWFJbkV2ZW50LlRodW1ibmFpbCA9IHtcbiAgICAgICAgICAgICAgICB1cmw6IHRodW1ibmFpbE1vZGVsLlVybCxcbiAgICAgICAgICAgICAgICBpZDogdGh1bWJuYWlsTW9kZWwuaWRcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBtZWRpYUluRXZlbnQuQ29tcHJlc3NlZCA9IHtcbiAgICAgICAgICAgICAgICB1cmw6IGNvbXByZXNzZWRNb2RlbC5VcmwsXG4gICAgICAgICAgICAgICAgaWQ6IGNvbXByZXNzZWRNb2RlbC5pZFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1lZGlhLkZpbGVUeXBlID0gJ3ZpZGVvJztcbiAgICAgICAgfVxuXG4gICAgICAgIC8qc2F2ZSBtYWluKi9cbiAgICAgICAgbWVkaWEuTmFtZSA9IGZpbGVOYW1lO1xuICAgICAgICBtZWRpYS5VcmwgPSByZXN1bHQubWFpbjtcbiAgICAgICAgbWVkaWEuRGltZW5zaW9uID0ge1xuICAgICAgICAgICAgd2lkdGg6IHJlc3VsdC5tYWluV2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IHJlc3VsdC5tYWluSGVpZ2h0XG4gICAgICAgIH07XG4gICAgICAgIG1lZGlhLlNpemUgPSByZXN1bHQubWFpblNpemU7XG4gICAgICAgIG1lZGlhLlVwbG9hZGVkQnkgPSByZWdpc3RyYXRpb24uX2lkO1xuICAgICAgICBjb25zdCBzYXZlZE1lZGlhID0gYXdhaXQgbWVkaWEuc2F2ZSgpO1xuICAgICAgICBjb25zb2xlLmxvZygnTG90JywgTG90LlN0YXR1cyk7XG4gICAgICAgIGlmIChMb3QgJiYgTG90LlN0YXR1cyA9PT0gMCkge1xuICAgICAgICAgICAgbG9nZ2VyLmluZm8oYGF1dG8gb3BlbmluZyBhdWN0aW9uIG9uIGltYWdlIHVwbG9hZCAke0xvdC5BcnRJZH1gKTtcbiAgICAgICAgICAgIExvdC5TdGF0dXMgPSAxO1xuICAgICAgICAgICAgZXZlbnQuUm91bmRzW1JvdW5kSW5kZXhdLkNvbnRlc3RhbnRzW0FydGlzdEluZGV4XS5FbmFibGVBdWN0aW9uID0gMTtcbiAgICAgICAgICAgIGF3YWl0IExvdC5zYXZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgLypGb2xsb3cvRm9sbG93aW5nIFN0YXJ0XG4gICAgICAgIGlmIChtZWRpYS5GaWxlVHlwZSA9PT0gJ2ltYWdlJyAmJiBMb3QuSW1hZ2VzLmluZGV4T2YobWVkaWEuX2lkLnRvU3RyaW5nKCkpID09PSAtMSkge1xuICAgICAgICAgICAgTG90LkltYWdlcy5wdXNoKHNhdmVkTWVkaWEuX2lkKTtcbiAgICAgICAgICAgIGF3YWl0IExvdC5zYXZlKCk7XG4gICAgICAgIH0gZWxzZSBpZiAobWVkaWEuRmlsZVR5cGUgPT09ICd2aWRlbycgJiYgTG90LlZpZGVvcy5pbmRleE9mKG1lZGlhLl9pZC50b1N0cmluZygpKSA9PT0gLTEpIHtcbiAgICAgICAgICAgIExvdC5WaWRlb3MucHVzaChzYXZlZE1lZGlhLl9pZCk7XG4gICAgICAgICAgICBhd2FpdCBMb3Quc2F2ZSgpO1xuICAgICAgICB9XG4gICAgICAgIEZvbGxvdy9Gb2xsb3dpbmcgZW5kKi9cblxuICAgICAgICBpZiAoIWVkaXQpIHtcbiAgICAgICAgICAgIG1lZGlhSW5FdmVudC5PcmlnaW5hbCA9IHtcbiAgICAgICAgICAgICAgICB1cmw6IG1lZGlhLlVybCxcbiAgICAgICAgICAgICAgICBpZDogbWVkaWEuaWRcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAocmVzdWx0LmlzSW1hZ2UpIHtcbiAgICAgICAgICAgICAgICBldmVudC5Sb3VuZHNbUm91bmRJbmRleF0uQ29udGVzdGFudHNbQXJ0aXN0SW5kZXhdLkltYWdlcy5wdXNoKG1lZGlhSW5FdmVudCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHZpZGVvIGxpbmtcbiAgICAgICAgICAgICAgICBldmVudC5Sb3VuZHNbUm91bmRJbmRleF0uQ29udGVzdGFudHNbQXJ0aXN0SW5kZXhdLlZpZGVvcy5wdXNoKG1lZGlhSW5FdmVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtZWRpYUluRXZlbnQuRWRpdGVkID0ge1xuICAgICAgICAgICAgICAgIHVybDogbWVkaWEuVXJsLFxuICAgICAgICAgICAgICAgIGlkOiBtZWRpYS5pZFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIG1lZGlhSW5FdmVudC5PcmlnaW5hbCA9IGV2ZW50LlJvdW5kc1tSb3VuZEluZGV4XS5Db250ZXN0YW50c1tBcnRpc3RJbmRleF0uSW1hZ2VzW0ltYWdlTWVkaWFJbmRleF0uT3JpZ2luYWw7XG4gICAgICAgICAgICBpZiAocmVzdWx0LmlzSW1hZ2UpIHtcbiAgICAgICAgICAgICAgICBldmVudC5Sb3VuZHNbUm91bmRJbmRleF0uQ29udGVzdGFudHNbQXJ0aXN0SW5kZXhdLkltYWdlc1tJbWFnZU1lZGlhSW5kZXhdID0gbWVkaWFJbkV2ZW50O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyB2aWRlbyBsaW5rXG4gICAgICAgICAgICAgICAgZXZlbnQuUm91bmRzW1JvdW5kSW5kZXhdLkNvbnRlc3RhbnRzW0FydGlzdEluZGV4XS5WaWRlb3NbVmlkZW9NZWRpYUluZGV4XSA9IG1lZGlhSW5FdmVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBldmVudC5zYXZlKCk7XG4gICAgICAgIGNvbnN0IGNhY2hlRGVsID0gcmVxLmFwcC5nZXQoJ2NhY2hlRGVsJyk7XG4gICAgICAgIGNvbnN0IGFydElkID0gbWVkaWFJbkV2ZW50LkFydElkO1xuICAgICAgICBsb2dnZXIuaW5mbyhgcmVtb3ZpbmcgYXVjdGlvbi1kZXRhaWwtJHthcnRJZH0gZHVlIHRvIHVwbG9hZGApO1xuICAgICAgICBjb25zdCBkZWxSZXMgPSBhd2FpdCBjYWNoZURlbChgYXVjdGlvbi1kZXRhaWwtJHthcnRJZH1gKTtcbiAgICAgICAgbG9nZ2VyLmluZm8oYHJlbW92ZWQgYXVjdGlvbi1kZXRhaWwtJHthcnRJZH0gIGR1ZSB0byB1cGxvYWQsICR7SlNPTi5zdHJpbmdpZnkoZGVsUmVzLCBudWxsLCAyKX1gKTtcbiAgICAgICAgYXdhaXQgY2FjaGVEZWwoYGF1Y3Rpb24tZGV0YWlsLSR7YXJ0SWR9YCk7XG4gICAgICAgIGxldCBzbGFja01lc3NhZ2U6IHN0cmluZztcbiAgICAgICAgaWYgKCFlZGl0KSB7XG4gICAgICAgICAgICBzbGFja01lc3NhZ2UgPSBgJHtyZWdpc3RyYXRpb24uRGlzcGxheVBob25lfSB1cGxvYWRlZCBhICR7bWVkaWEuRmlsZVR5cGV9IGZvclxuICAgICAgICAgICAgJHtldmVudC5OYW1lLnJlcGxhY2UoL1tcXFxcV19dKy9nLCAnJyl9LSR7Um91bmROdW1iZXJ9LSR7RWFzZWxOdW1iZXJ9LSR7QXJ0aXN0TmFtZX0gLSAke21lZGlhSW5FdmVudC5PcmlnaW5hbC51cmx9YDtcbiAgICAgICAgICAgIC8vIFRPRE8gb3BlbiBhdWN0aW9uIGlmIG5vdCBvcGVuIGFscmVhZHlcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2xhY2tNZXNzYWdlID0gYCR7cmVnaXN0cmF0aW9uLkRpc3BsYXlQaG9uZX0gZWRpdGVkIGEgJHttZWRpYS5GaWxlVHlwZX0gZm9yXG4gICAgICAgICAgICAke2V2ZW50Lk5hbWUucmVwbGFjZSgvW1xcXFxXX10rL2csICcnKX0tJHtSb3VuZE51bWJlcn0tJHtFYXNlbE51bWJlcn0tJHtBcnRpc3ROYW1lfSAtICR7bWVkaWFJbkV2ZW50LkVkaXRlZC51cmx9YDtcbiAgICAgICAgfVxuICAgICAgICBwb3N0VG9TbGFjayh7XG4gICAgICAgICAgICAndGV4dCc6IHNsYWNrTWVzc2FnZVxuICAgICAgICB9KS5jYXRjaCgoKSA9PiBsb2dnZXIuaW5mbygndXBsb2FkIHNsYWNrIGNhbGwgZmFpbGVkJykpO1xuICAgICAgICBpZiAodG90YWxJbWFnZXNJblJvdW5kID49IHRvdGFsQ29udGVzdGFudHNJblJvdW5kKSB7XG4gICAgICAgICAgICBhd2FpdCBFdmVudEluY3JlbWVudFJvdW5kVjIocmVxLCBldmVudC5faWQsIHJlZ2lzdHJhdGlvbi5faWQsIHJvdW5kTm8pO1xuICAgICAgICB9XG4gICAgICAgIG1lZGlhSW5FdmVudC5GaWxlVHlwZSA9IG1lZGlhLkZpbGVUeXBlICYmIG1lZGlhLkZpbGVUeXBlLnRvU3RyaW5nKCk7XG4gICAgICAgIHJldHVybiBtZWRpYUluRXZlbnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cge1xuICAgICAgICAgICAgc3RhdHVzOiA0MDMsXG4gICAgICAgICAgICBtZXNzYWdlOiAnSW52YWxpZCBwYXJhbWV0ZXJzIHBhc3NlZCdcbiAgICAgICAgfTtcbiAgICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBfdXBsb2FkKHJhd0ltYWdlOiBzdHJpbmcsIG9yaWdpbmFsUGF0aDogc3RyaW5nLCB0aHVtYm5haWxQYXRoOiBzdHJpbmcsIGNvbXByZXNzZWRQYXRoOiBzdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlZGl0PzogYm9vbGVhbiwgaXNQYXRoPzogYm9vbGVhbik6IFByb21pc2U8e1xuICAgIG1haW46IHN0cmluZyxcbiAgICB0aHVtYj86IHN0cmluZyxcbiAgICBjb21wcmVzc2VkPzogc3RyaW5nLFxuICAgIG1haW5TdGFydDogRGF0ZSxcbiAgICBtYWluRW5kOiBEYXRlLFxuICAgIG1haW5IZWlnaHQ6IG51bWJlcixcbiAgICBtYWluV2lkdGg6IG51bWJlcixcbiAgICBtYWluU2l6ZTogbnVtYmVyLFxuICAgIG1haW5GaWxlOiBzdHJpbmcsXG4gICAgaXNJbWFnZTogYm9vbGVhbixcbiAgICBpc1ZpZGVvOiBib29sZWFuLFxuICAgIC8vIG9ubHkgZm9yIGltYWdlXG4gICAgY29tcHJlc3Npb25TdGFydD86IERhdGUsXG4gICAgY29tcHJlc3Npb25FbmQ/OiBEYXRlLFxuICAgIGNvbXByZXNzZWRIZWlnaHQ/OiBudW1iZXIsXG4gICAgY29tcHJlc3NlZFdpZHRoPzogbnVtYmVyLFxuICAgIGNvbXByZXNzZWRTaXplPzogbnVtYmVyLFxuICAgIGNvbXByZXNzZWRGaWxlPzogc3RyaW5nLFxuICAgIHRodW1iU3RhcnQ/OiBEYXRlLFxuICAgIHRodW1iRW5kPzogRGF0ZSxcbiAgICB0aHVtYkhlaWdodD86IG51bWJlcixcbiAgICB0aHVtYldpZHRoPzogbnVtYmVyLFxuICAgIHRodW1iU2l6ZT86IG51bWJlcixcbiAgICB0aHVtYkZpbGU/OiBzdHJpbmdcbn0+IHtcbiAgICBsZXQgaW1nQnVmZmVyO1xuICAgIGxldCBmaWxlUGF0aDogc3RyaW5nO1xuICAgIGZpbGVQYXRoID0gYCR7X19kaXJuYW1lfS8uLi9wdWJsaWMvdXBsb2Fkcy9pbWFnZXMvb3JpZ2luYWxzLyR7b3JpZ2luYWxQYXRofWA7XG5cbiAgICBpZiAoIWlzUGF0aCkge1xuICAgICAgICBjb25zdCBiYXNlNjREYXRhID0gcmF3SW1hZ2UucmVwbGFjZSgvXmRhdGE6aW1hZ2VcXC8oW1xcdytdKyk7YmFzZTY0LywgJycpO1xuICAgICAgICBpbWdCdWZmZXIgPSBCdWZmZXIuZnJvbShiYXNlNjREYXRhLCAnYmFzZTY0Jyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaW1nQnVmZmVyID0gYXdhaXQgZnMucmVhZEZpbGUocmF3SW1hZ2UpO1xuICAgICAgICBmaWxlUGF0aCA9IHJhd0ltYWdlO1xuICAgIH1cbiAgICBjb25zdCBmVHlwZSA9IGZpbGVUeXBlKGltZ0J1ZmZlcik7XG4gICAgY29uc3QgaXNJbWFnZSA9IGltYWdlRXh0ZW5zaW9ucy5pbmRleE9mKGZUeXBlLmV4dCkgPiAtMTtcbiAgICBjb25zdCBpc1ZpZGVvID0gdmlkZW9FeHRlbnNpb25zLmluZGV4T2YoZlR5cGUuZXh0KSA+IC0xO1xuICAgIGlmIChpc0ltYWdlKSB7XG4gICAgICAgIHJldHVybiBfcHJvY2Vzc0ltYWdlKGZpbGVQYXRoLCBvcmlnaW5hbFBhdGgsIHRodW1ibmFpbFBhdGgsIGNvbXByZXNzZWRQYXRoLCBpbWdCdWZmZXIsIGlzUGF0aCwgZWRpdCk7XG4gICAgfSBlbHNlIGlmIChpc1ZpZGVvKSB7XG4gICAgICAgIHJldHVybiBfcHJvY2Vzc1ZpZGVvKGZpbGVQYXRoLCBvcmlnaW5hbFBhdGgsIHRodW1ibmFpbFBhdGgsIGNvbXByZXNzZWRQYXRoLCBpbWdCdWZmZXIsIGlzUGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBGaWxlICR7ZlR5cGUuZXh0fWApO1xuICAgIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIF9jYWxjdWxhdGVUaHVtYm5haWwoYmluYXJ5OiBCdWZmZXIsIHRodW1ibmFpbFBhdGg6IHN0cmluZywgd2lkdGg6IG51bWJlciwgaGVpZ2h0PzogbnVtYmVyKSB7XG4gICAgY29uc3Qgc3RhcnREYXRlID0gbmV3IERhdGUoKTtcbiAgICBjb25zdCBmaWxlID0gYCR7dGh1bWJuYWlsUGF0aH0uanBnYDtcbiAgICAvLyAxMDgsIDE3MCAtPiAxNTAgeCAyMzZcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzaGFycChiaW5hcnkpLnJvdGF0ZSgpLnJlc2l6ZSh3aWR0aCwgaGVpZ2h0KS5qcGVnKHtcbiAgICAgICAgcXVhbGl0eTogNTAsXG4gICAgICAgIGNocm9tYVN1YnNhbXBsaW5nOiAnNDo0OjQnLFxuICAgICAgICAvLyB0cmVsbGlzUXVhbnRpc2F0aW9uOiB0cnVlLFxuICAgIH0pLnRvRmlsZShmaWxlKTtcbiAgICBjb25zdCBlbmREYXRlID0gbmV3IERhdGUoKTtcbiAgICByZXR1cm4ge1xuICAgICAgICBzdGFydERhdGU6IHN0YXJ0RGF0ZSxcbiAgICAgICAgZW5kRGF0ZTogZW5kRGF0ZSxcbiAgICAgICAgaGVpZ2h0OiByZXN1bHQuaGVpZ2h0LFxuICAgICAgICB3aWR0aDogcmVzdWx0LndpZHRoLFxuICAgICAgICBzaXplOiByZXN1bHQuc2l6ZSxcbiAgICAgICAgZmlsZTogZmlsZVxuICAgIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBfd3JpdGVGaWxlKGZpbGVQYXRoOiBzdHJpbmcsIGJpbmFyeTogQnVmZmVyLCBpc1BhdGg/OiBib29sZWFuKSB7XG4gICAgY29uc3Qgc3RhcnREYXRlID0gbmV3IERhdGUoKTtcbiAgICBjb25zdCBpbWFnZU1ldGEgPSBhd2FpdCBzaGFycChiaW5hcnkpLm1ldGFkYXRhKCk7XG4gICAgY29uc3QgZmlsZSA9IGAke2ZpbGVQYXRofS4ke2ltYWdlTWV0YS5mb3JtYXR9YDtcbiAgICBpZiAoIWlzUGF0aCkge1xuICAgICAgICBhd2FpdCBmcy53cml0ZUZpbGUoZmlsZSwgYmluYXJ5KTtcbiAgICB9XG4gICAgY29uc3QgZW5kRGF0ZSA9IG5ldyBEYXRlKCk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgc3RhcnREYXRlOiBzdGFydERhdGUsXG4gICAgICAgIGVuZERhdGU6IGVuZERhdGUsXG4gICAgICAgIGhlaWdodDogaW1hZ2VNZXRhLmhlaWdodCxcbiAgICAgICAgd2lkdGg6IGltYWdlTWV0YS53aWR0aCxcbiAgICAgICAgc2l6ZTogaW1hZ2VNZXRhLnNpemUsXG4gICAgICAgIGZpbGU6IGlzUGF0aCA/IGZpbGVQYXRoIDogZmlsZVxuICAgIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRSb3VuZEltYWdlcyhyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIGNvbnN0IGV2ZW50SWQgPSByZXEucGFyYW1zLmV2ZW50SWQ7XG4gICAgY29uc3Qgcm91bmROdW1iZXIgPSBwYXJzZUludChyZXEucGFyYW1zLnJvdW5kTm8pO1xuICAgIGNvbnN0IGV2ZW50ID0gYXdhaXQgRXZlbnRNb2RlbC5maW5kQnlJZChldmVudElkKVxuICAgICAgICAuc2VsZWN0KFsnUm91bmRzJywgJ0N1cnJlbnRSb3VuZCcsICdFSUQnLCAnRW5hYmxlQXVjdGlvbiddKVxuICAgICAgICAucG9wdWxhdGUoJ1JvdW5kcy5Db250ZXN0YW50cy5EZXRhaWwnKTtcbiAgICBpZiAoIWV2ZW50KSB7XG4gICAgICAgIG5leHQoe1xuICAgICAgICAgICAgc3RhdHVzOiA0MDMsXG4gICAgICAgICAgICBtZXNzYWdlOiBgSW52YWxpZCBldmVudCBJZCAke2V2ZW50SWR9YFxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIDtcbiAgICB9XG4gICAgY29uc3QgY3VycmVudFJvdW5kID0gZXZlbnQuQ3VycmVudFJvdW5kICYmIGV2ZW50LkN1cnJlbnRSb3VuZC5Sb3VuZE51bWJlcjtcbiAgICBmb3IgKCBsZXQgaiA9IDA7IGogPCBldmVudC5Sb3VuZHMubGVuZ3RoOyBqKysgKSB7XG4gICAgICAgIGlmIChldmVudC5Sb3VuZHNbal0uUm91bmROdW1iZXIgPT09IHJvdW5kTnVtYmVyKSB7XG4gICAgICAgICAgICBjb25zdCBhcnRpc3RJbWFnZXMgPSBhcnRpc3RXaXNlSW1hZ2VzKGV2ZW50LlJvdW5kc1tqXS5Db250ZXN0YW50cyk7XG4gICAgICAgICAgICBjb25zdCByZXNwb25zZTogUm91bmRBcnRpc3RzSW50ZXJmYWNlID0ge1xuICAgICAgICAgICAgICAgIEV2ZW50SWQ6IGV2ZW50SWQsXG4gICAgICAgICAgICAgICAgUm91bmROdW1iZXI6IHJvdW5kTnVtYmVyLFxuICAgICAgICAgICAgICAgIEFydGlzdHM6IGFydGlzdEltYWdlcy5hcnRpc3RzLFxuICAgICAgICAgICAgICAgIElzQ3VycmVudFJvdW5kOiBjdXJyZW50Um91bmQgPT09IHJvdW5kTnVtYmVyLFxuICAgICAgICAgICAgICAgIEhhc09wZW5Sb3VuZDogIWV2ZW50LlJvdW5kc1tqXS5Jc0ZpbmlzaGVkLFxuICAgICAgICAgICAgICAgIEhhc0ltYWdlczogYXJ0aXN0SW1hZ2VzLmhhc0ltYWdlcyxcbiAgICAgICAgICAgICAgICBFSUQ6IGV2ZW50LkVJRCB8fCAnJyxcbiAgICAgICAgICAgICAgICBFbmFibGVBdWN0aW9uOiBldmVudC5FbmFibGVBdWN0aW9uXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgY29uc3Qgb3BlcmF0aW9uUmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PFJvdW5kQXJ0aXN0c0ludGVyZmFjZT4gPSB7XG4gICAgICAgICAgICAgICAgU3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBEYXRhOiByZXNwb25zZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJlcy5qc29uKG9wZXJhdGlvblJlc3VsdCk7XG4gICAgICAgICAgICByZXR1cm4gO1xuICAgICAgICB9XG4gICAgfVxuICAgIG5leHQoe1xuICAgICAgICBzdGF0dXM6IDQwMyxcbiAgICAgICAgbWVzc2FnZTogYE5vIG1hdGNoaW5nIHJvdW5kICR7cm91bmROdW1iZXJ9IGZvdW5kIGluICR7ZXZlbnRJZH1gXG4gICAgfSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRNZWRpYUlkKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVnaXN0cmF0aW9uID0gYXdhaXQgUmVnaXN0cmF0aW9uTW9kZWwuZmluZE9uZSh7XG4gICAgICAgICAgICBIYXNoOiByZXEucGFyYW1zLmhhc2hcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICghcmVnaXN0cmF0aW9uKSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzKDQwMyk7XG4gICAgICAgICAgICByZXMuanNvbih7XG4gICAgICAgICAgICAgICAgTWVzc2FnZTogYEludmFsaWQgdXNlciBoYXNoICR7cmVxLnBhcmFtcy5oYXNofWBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBiYXNlSWRPYmogPSByZXEuYm9keTtcbiAgICAgICAgY29uc3QgZmlsZUV4dGVuc2lvbiA9IG1pbWUuZXh0ZW5zaW9uKGJhc2VJZE9iai5maWxlVHlwZSk7XG4gICAgICAgIGlmICghZmlsZUV4dGVuc2lvbikge1xuICAgICAgICAgICAgbmV4dCh7XG4gICAgICAgICAgICAgICAgc3RhdHVzOiA0MDAsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVuc3VwcG9ydGVkIGZpbGUgdHlwZSAke2Jhc2VJZE9iai5maWxlVHlwZX1gXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiA7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGZpbGVUeXBlO1xuICAgICAgICBpZiAoaW1hZ2VFeHRlbnNpb25zLmluZGV4T2YoZmlsZUV4dGVuc2lvbikgPiAtMSkge1xuICAgICAgICAgICAgZmlsZVR5cGUgPSAncGhvdG8nO1xuICAgICAgICB9IGVsc2UgaWYgKHZpZGVvRXh0ZW5zaW9ucy5pbmRleE9mKGZpbGVFeHRlbnNpb24pID4gLTEpIHtcbiAgICAgICAgICAgIGZpbGVUeXBlID0gJ3ZpZGVvJztcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWZpbGVFeHRlbnNpb24pIHtcbiAgICAgICAgICAgIG5leHQoe1xuICAgICAgICAgICAgICAgIHN0YXR1czogNDAwLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVbnN1cHBvcnRlZCBmaWxlIHR5cGUgJHtmaWxlRXh0ZW5zaW9ufWBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBtZWRpYSA9IG5ldyBNZWRpYU1vZGVsKHtcbiAgICAgICAgICAgIFNpemU6IDAsXG4gICAgICAgICAgICBVcGxvYWRlZEJ5OiByZWdpc3RyYXRpb24uX2lkLFxuICAgICAgICAgICAgVHlwZTogJ29yaWdpbmFsJyxcbiAgICAgICAgICAgIFVwbG9hZFN0YXJ0OiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgRmlsZVR5cGU6IGZpbGVUeXBlXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBzYXZlZE1lZGlhID0gYXdhaXQgbWVkaWEuc2F2ZSgpO1xuICAgICAgICBiYXNlSWRPYmouaWQgPSBgJHtiYXNlSWRPYmoucHJlZml4SWR9LSR7c2F2ZWRNZWRpYS5faWR9YDtcbiAgICAgICAgYmFzZUlkT2JqLk1lZGlhSWQgPSBzYXZlZE1lZGlhLl9pZDtcbiAgICAgICAgc2F2ZWRNZWRpYS5OYW1lID0gYCR7cmVxLnBhcmFtcy5iYXNlSWRKc29ufS0ke21lZGlhLl9pZH1gO1xuICAgICAgICBiYXNlSWRPYmouZmlsZVR5cGUgPSBtZWRpYS5GaWxlVHlwZTtcbiAgICAgICAgYXdhaXQgc2F2ZWRNZWRpYS5zYXZlKCk7XG4gICAgICAgIGxvZ2dlci5pbmZvKGBiYXNlSWRPYmogJHtKU09OLnN0cmluZ2lmeShiYXNlSWRPYmopfWApO1xuICAgICAgICByZXMuanNvbihiYXNlSWRPYmopO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgbmV4dChlKTtcbiAgICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXN1bWFibGVVcGxvYWQocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7dmFsaWRhdGlvbiwgb3V0cHV0RmlsZU5hbWV9ID0gYXdhaXQgcmVzdW1hYmxlLnBvc3QocmVxKTtcbiAgICAgICAgaWYgKHZhbGlkYXRpb24gPT09ICdkb25lJykge1xuICAgICAgICAgICAgcmVzLmpzb24oe3N0YXR1czogdmFsaWRhdGlvbiwgb3V0cHV0RmlsZU5hbWU6IG91dHB1dEZpbGVOYW1lfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXMuanNvbih7c3RhdHVzOiB2YWxpZGF0aW9ufSk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufVxuXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjaGVja1VwbG9hZChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHtzdGF0dXN9ID0gYXdhaXQgcmVzdW1hYmxlLmdldChyZXEpO1xuICAgICAgICByZXMuc3RhdHVzKHN0YXR1cyA/IDIwMCA6IDQwNCk7XG4gICAgICAgIHJlcy5qc29uKHN0YXR1cyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBuZXh0KGUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxpbmtVcGxvYWQocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBib2R5ID0gcmVxLmJvZHk7XG4gICAgICAgIGJvZHkubWVkaWFJbkV2ZW50ID0gYXdhaXQgX3VwbG9hZERvYyhyZXEsIGJvZHkuaGFzaCwgYm9keS5ldmVudElkLCBib2R5LnJvdW5kTnVtYmVyLCBib2R5LmNvbnRlc3RhbnRJZCxcbiAgICAgICAgICAgIGJvZHkub3V0cHV0RmlsZU5hbWUsIGZhbHNlLCBudWxsLCBib2R5Lk1lZGlhSWQpO1xuICAgICAgICByZXMuanNvbihib2R5KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gX3Byb2Nlc3NWaWRlbyhmaWxlUGF0aDogc3RyaW5nLCBvcmlnaW5hbFBhdGg6IHN0cmluZywgdGh1bWJuYWlsUGF0aDogc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcHJlc3NlZFBhdGg6IHN0cmluZywgaW1nQnVmZmVyOiBCdWZmZXIsIGlzUGF0aDogYm9vbGVhbikge1xuICAgIHJldHVybiB7XG4gICAgICAgIG1haW46IGAke3Byb2Nlc3MuZW52Lk1FRElBX1NJVEVfVVJMfSR7ZmlsZVBhdGguc3Vic3RyKGZpbGVQYXRoLmluZGV4T2YoJ3B1YmxpYycpICsgJ3B1YmxpYycubGVuZ3RoKX1gLFxuICAgICAgICBtYWluU3RhcnQ6IG5ldyBEYXRlKCksXG4gICAgICAgIG1haW5FbmQ6IG5ldyBEYXRlKCksXG4gICAgICAgIG1haW5IZWlnaHQ6IDAsXG4gICAgICAgIG1haW5XaWR0aDogMCxcbiAgICAgICAgbWFpblNpemU6IDAsXG4gICAgICAgIG1haW5GaWxlOiBmaWxlUGF0aCxcbiAgICAgICAgaXNJbWFnZTogZmFsc2UsXG4gICAgICAgIGlzVmlkZW86IHRydWVcbiAgICB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gX3Byb2Nlc3NJbWFnZShmaWxlUGF0aDogc3RyaW5nLCBvcmlnaW5hbFBhdGg6IHN0cmluZywgdGh1bWJuYWlsUGF0aDogc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcHJlc3NlZFBhdGg6IHN0cmluZywgaW1nQnVmZmVyOiBCdWZmZXIsIGlzUGF0aDogYm9vbGVhbiwgZWRpdDogYm9vbGVhbikge1xuICAgIGlmIChlZGl0KSB7XG4gICAgICAgIGZpbGVQYXRoID0gYCR7X19kaXJuYW1lfS8uLi9wdWJsaWMvdXBsb2Fkcy9pbWFnZXMvZWRpdGVkLyR7b3JpZ2luYWxQYXRofWA7XG4gICAgfVxuICAgIGNvbnN0IHRodW1iUGF0aCA9IGAke19fZGlybmFtZX0vLi4vcHVibGljL3VwbG9hZHMvaW1hZ2VzL3RodW1ibmFpbHMvJHt0aHVtYm5haWxQYXRofWA7XG4gICAgY29uc3Qgb3B0aW1pemVkUGF0aCA9IGAke19fZGlybmFtZX0vLi4vcHVibGljL3VwbG9hZHMvaW1hZ2VzL2NvbXByZXNzZWQvJHtjb21wcmVzc2VkUGF0aH1gO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgX3dyaXRlRmlsZShmaWxlUGF0aCwgaW1nQnVmZmVyLCBpc1BhdGgpLFxuICAgICAgICBfY2FsY3VsYXRlVGh1bWJuYWlsKGltZ0J1ZmZlciwgdGh1bWJQYXRoLCBkaW1zLnRodW1ibmFpbC53aWR0aCwgZGltcy50aHVtYm5haWwuaGVpZ2h0KSxcbiAgICAgICAgX2NhbGN1bGF0ZVRodW1ibmFpbChpbWdCdWZmZXIsIG9wdGltaXplZFBhdGgsIGRpbXMuY29tcHJlc3NlZC53aWR0aClcbiAgICBdKTtcbiAgICByZXR1cm4ge1xuICAgICAgICBtYWluOiBgJHtwcm9jZXNzLmVudi5NRURJQV9TSVRFX1VSTH0ke3Jlc3VsdFswXS5maWxlLnN1YnN0cihyZXN1bHRbMF0uZmlsZS5pbmRleE9mKCdwdWJsaWMnKSArICdwdWJsaWMnLmxlbmd0aCl9YCxcbiAgICAgICAgbWFpblN0YXJ0OiByZXN1bHRbMF0uc3RhcnREYXRlLFxuICAgICAgICBtYWluRW5kOiByZXN1bHRbMF0uZW5kRGF0ZSxcbiAgICAgICAgbWFpbkhlaWdodDogcmVzdWx0WzBdLmhlaWdodCxcbiAgICAgICAgbWFpbldpZHRoOiByZXN1bHRbMF0ud2lkdGgsXG4gICAgICAgIG1haW5TaXplOiByZXN1bHRbMF0uc2l6ZSxcbiAgICAgICAgbWFpbkZpbGU6IHJlc3VsdFswXS5maWxlLFxuICAgICAgICB0aHVtYjogYCR7cHJvY2Vzcy5lbnYuTUVESUFfU0lURV9VUkx9JHtyZXN1bHRbMV0uZmlsZS5zdWJzdHIocmVzdWx0WzFdLmZpbGUuaW5kZXhPZigncHVibGljJykgKyAncHVibGljJy5sZW5ndGgpfWAsXG4gICAgICAgIHRodW1iU3RhcnQ6IHJlc3VsdFsxXS5zdGFydERhdGUsXG4gICAgICAgIHRodW1iRW5kOiByZXN1bHRbMV0uZW5kRGF0ZSxcbiAgICAgICAgdGh1bWJIZWlnaHQ6IHJlc3VsdFsxXS5oZWlnaHQsXG4gICAgICAgIHRodW1iV2lkdGg6IHJlc3VsdFsxXS53aWR0aCxcbiAgICAgICAgdGh1bWJTaXplOiByZXN1bHRbMV0uc2l6ZSxcbiAgICAgICAgdGh1bWJGaWxlOiByZXN1bHRbMV0uIGZpbGUsXG4gICAgICAgIGNvbXByZXNzZWQ6IGAke3Byb2Nlc3MuZW52Lk1FRElBX1NJVEVfVVJMfSR7cmVzdWx0WzJdLmZpbGUuc3Vic3RyKHJlc3VsdFsyXS5maWxlLmluZGV4T2YoJ3B1YmxpYycpICsgJ3B1YmxpYycubGVuZ3RoKX1gLFxuICAgICAgICBjb21wcmVzc2lvblN0YXJ0OiByZXN1bHRbMl0uc3RhcnREYXRlLFxuICAgICAgICBjb21wcmVzc2lvbkVuZDogcmVzdWx0WzJdLmVuZERhdGUsXG4gICAgICAgIGNvbXByZXNzZWRIZWlnaHQ6IHJlc3VsdFsyXS5oZWlnaHQsXG4gICAgICAgIGNvbXByZXNzZWRXaWR0aDogcmVzdWx0WzJdLndpZHRoLFxuICAgICAgICBjb21wcmVzc2VkU2l6ZTogcmVzdWx0WzJdLnNpemUsXG4gICAgICAgIGNvbXByZXNzZWRGaWxlOiByZXN1bHRbMl0uZmlsZSxcbiAgICAgICAgaXNJbWFnZTogdHJ1ZSxcbiAgICAgICAgaXNWaWRlbzogZmFsc2VcbiAgICB9O1xufSJdfQ==
