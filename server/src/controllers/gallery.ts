import { NextFunction, Request, Response } from 'express';
import { default as EventModel } from '../models/Event';
import MediaModel, { MediaDocument } from '../models/Media';
import * as fs from 'fs-extra';
import * as sharp from 'sharp';
import RegistrationModel from '../models/Registration';
import { DataOperationResult } from '../../../shared/OperationResult';
import { ArtistIndividualImage } from '../../../shared/RoundContestantDTO';
import postToSlack from '../common/Slack';
import artistWiseImages from '../common/ArtistWiseImages';
import { RoundArtistsInterface } from '../../../shared/ArtistImageDTO';
import logger from '../config/logger';
import RegistrationDTO from '../../../shared/RegistrationDTO';
import { EventIncrementRoundV2 } from '../common/eventRoundIncrementV2';
import { Resumable } from '../common/Resumable';
import * as mime from 'mime-types';
import fileType = require('file-type');
import LotModel, { LotDocument } from '../models/Lot';

const imageExtensions = ['jpg', 'jpeg', 'png'];
// qt=mov
const videoExtensions = ['mov', 'mp4', 'mpg', 'avi', 'flv', 'wmv', 'tif', 'qt'];

const resumable = new Resumable();
const dims = {
    compressed: {
        width: 1366
    },
    thumbnail: {
        width: 280,
        height: 440
    }
};

export async function upload(req: Request, res: Response, next: NextFunction) {
    try {
        const media = await _uploadDoc(req, req.params.hash, req.params.eventId, parseInt(req.params.roundNo),
            req.params.contestantId, req.body.rawImage, false);
        const operationResult: DataOperationResult<ArtistIndividualImage> = {
            Success: true,
            Data: media
        };
        await res.json(operationResult);
    } catch (e) {
        e.status = 500;
        next(e);
    }
}

export async function uploadEdit(req: Request, res: Response, next: NextFunction) {
    try {
        const media = await _uploadDoc(req, req.user, req.params.eventId, parseInt(req.params.roundNo),
            req.params.contestantId, req.body.rawImage, true, req.params.index);
        const operationResult: DataOperationResult<ArtistIndividualImage> = {
            Success: true,
            Data: media
        };
        await res.json(operationResult);
    } catch (e) {
        e.status = 500;
        next(e);
    }
}

export async function _uploadDoc(req: Request, hash: (string | RegistrationDTO), eventId: any, roundNo: number,
                                 contestantId: any, rawImage: string, edit?: boolean, ImageMediaIndex?: number,
                                 mediaId?: any, VideoMediaIndex?: number) {
    let registration: RegistrationDTO;
    let totalContestantsInRound = 0;
    let totalImagesInRound = 0;
    if (!edit) {
        const regResults = await Promise.all([
            EventModel.findOne({_id: eventId}).select(['RegistrationsVoteFactor']).sort({_id: -1}),
            RegistrationModel.findOne({Hash: hash})
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
    } else if (typeof hash ===  'object') {
        registration = hash;
    }
    // user is eligible to upload
    const event = await EventModel.findById(eventId)
        .populate('Rounds.Contestants.Detail');
    // .populate('Rounds.Contestants');
    let EaselNumber = 0;
    let ArtistName = '';
    let media: MediaDocument;
    if (!mediaId) {
        media = new MediaModel();
        media.UploadStart = new Date();
    } else {
        media = await MediaModel.findById(mediaId);
    }
    if (edit) {
        media.Type = 'edited';
    } else {
        media.Type = 'original';
        await media.save();
    }

    const RoundNumber = roundNo;
    let RoundIndex = 0;
    let ArtistIndex = 0;
    let existingImageMediaObj;
    let existingVideoMediaObj;
    let Lot: LotDocument;
    for (let i = 0; i < event.Rounds.length; i++) {
        if (event.Rounds[i].RoundNumber == RoundNumber) {
            for (let j = 0; j < event.Rounds[i].Contestants.length; j++) {
                if (event.Rounds[i].Contestants[j]._id == contestantId) {
                    EaselNumber = event.Rounds[i].Contestants[j].EaselNumber;
                    ArtistName = event.Rounds[i].Contestants[j].Detail.Name.replace(/[\W_]+/g, '');
                    ArtistIndex = j;
                    if (ImageMediaIndex) {
                        existingImageMediaObj = event.Rounds[i].Contestants[j].Images[ImageMediaIndex];
                    } else if (VideoMediaIndex) {
                        existingVideoMediaObj = event.Rounds[i].Contestants[j].Videos[VideoMediaIndex];
                    }
                    // break;
                    Lot = await LotModel.findById(event.Rounds[i].Contestants[j].Lot._id);
                }
                if (event.Rounds[i].Contestants[j].Images.length > 0) {
                    totalImagesInRound ++;
                }
                if (event.Rounds[i].Contestants[j].Videos.length > 0) {
                    totalImagesInRound ++;
                }
                if (event.Rounds[i].Contestants[j].Enabled && event.Rounds[i].Contestants[j].EaselNumber > 0) {
                    totalContestantsInRound ++;
                }
            }
            RoundIndex = i;
            break;
        }
    }
    logger.info(`EaselNumber ${EaselNumber}, 'ArtistName', ${ArtistName}, 'existingMediaObj ${JSON.stringify(existingImageMediaObj, null, 3)}`);
    if (EaselNumber > 0) {
        const fileName = `${event.Name.replace(/[\W_]+/g, '')}-${RoundNumber}-${EaselNumber}-${ArtistName}-${media.id}`;
        const compressedPath = `${fileName}-${dims.compressed.width}`;
        const thumbnailPath = `${fileName}-${dims.thumbnail.width}x${dims.thumbnail.height}`;
        const originalPath = `${fileName}`;
        const result = await _upload(rawImage, originalPath, thumbnailPath, compressedPath, edit, !!mediaId);
        media.UploadFinish = result.mainEnd;
        /*Save media in the event*/
        const mediaInEvent: {
            'Thumbnail'?: {
                url: string;
                id: string;
            };
            'Compressed'?: {
                url: string;
                id: string;
            };
            'Original': {
                url: string;
                id: string;
            };
            'Edited': {
                url: string;
                id: string;
            };
            ArtId: string;
            FileType?: string;
        } = {
            'ArtId': `${event.EID}-${RoundNumber}-${EaselNumber}`,
            'Edited': undefined,
            'Original': undefined
        };
        if (result.isImage) {
            media.FileType = 'image';
            let thumbnailModel;
            let compressedModel;
            if (!edit) {
                thumbnailModel = new MediaModel();
                compressedModel = new MediaModel();
            } else {
                compressedModel = await MediaModel.findById(existingImageMediaObj.Compressed.id);
                thumbnailModel = await MediaModel.findById(existingImageMediaObj.Thumbnail.id);
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
        } else {
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
            logger.info(`auto opening auction on image upload ${Lot.ArtId}`);
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
            } else {
                // video link
                event.Rounds[RoundIndex].Contestants[ArtistIndex].Videos.push(mediaInEvent);
            }
        } else {
            mediaInEvent.Edited = {
                url: media.Url,
                id: media.id
            };
            mediaInEvent.Original = event.Rounds[RoundIndex].Contestants[ArtistIndex].Images[ImageMediaIndex].Original;
            if (result.isImage) {
                event.Rounds[RoundIndex].Contestants[ArtistIndex].Images[ImageMediaIndex] = mediaInEvent;
            } else {
                // video link
                event.Rounds[RoundIndex].Contestants[ArtistIndex].Videos[VideoMediaIndex] = mediaInEvent;
            }
        }
        await event.save();
        const cacheDel = req.app.get('cacheDel');
        const artId = mediaInEvent.ArtId;
        logger.info(`removing auction-detail-${artId} due to upload`);
        const delRes = await cacheDel(`auction-detail-${artId}`);
        logger.info(`removed auction-detail-${artId}  due to upload, ${JSON.stringify(delRes, null, 2)}`);
        await cacheDel(`auction-detail-${artId}`);
        let slackMessage: string;
        if (!edit) {
            slackMessage = `${registration.DisplayPhone} uploaded a ${media.FileType} for
            ${event.Name.replace(/[\\W_]+/g, '')}-${RoundNumber}-${EaselNumber}-${ArtistName} - ${mediaInEvent.Original.url}`;
            // TODO open auction if not open already

        } else {
            slackMessage = `${registration.DisplayPhone} edited a ${media.FileType} for
            ${event.Name.replace(/[\\W_]+/g, '')}-${RoundNumber}-${EaselNumber}-${ArtistName} - ${mediaInEvent.Edited.url}`;
        }
        postToSlack({
            'text': slackMessage
        }).catch(() => logger.info('upload slack call failed'));
        if (totalImagesInRound >= totalContestantsInRound) {
            await EventIncrementRoundV2(req, event._id, registration._id, roundNo);
        }
        mediaInEvent.FileType = media.FileType && media.FileType.toString();
        return mediaInEvent;
    } else {
        throw {
            status: 403,
            message: 'Invalid parameters passed'
        };
    }
}

export async function _upload(rawImage: string, originalPath: string, thumbnailPath: string, compressedPath: string,
                              edit?: boolean, isPath?: boolean): Promise<{
    main: string,
    thumb?: string,
    compressed?: string,
    mainStart: Date,
    mainEnd: Date,
    mainHeight: number,
    mainWidth: number,
    mainSize: number,
    mainFile: string,
    isImage: boolean,
    isVideo: boolean,
    // only for image
    compressionStart?: Date,
    compressionEnd?: Date,
    compressedHeight?: number,
    compressedWidth?: number,
    compressedSize?: number,
    compressedFile?: string,
    thumbStart?: Date,
    thumbEnd?: Date,
    thumbHeight?: number,
    thumbWidth?: number,
    thumbSize?: number,
    thumbFile?: string
}> {
    let imgBuffer;
    let filePath: string;
    filePath = `${__dirname}/../public/uploads/images/originals/${originalPath}`;

    if (!isPath) {
        const base64Data = rawImage.replace(/^data:image\/([\w+]+);base64/, '');
        imgBuffer = Buffer.from(base64Data, 'base64');
    } else {
        imgBuffer = await fs.readFile(rawImage);
        filePath = rawImage;
    }
    const fType = fileType(imgBuffer);
    const isImage = imageExtensions.indexOf(fType.ext) > -1;
    const isVideo = videoExtensions.indexOf(fType.ext) > -1;
    if (isImage) {
        return _processImage(filePath, originalPath, thumbnailPath, compressedPath, imgBuffer, isPath, edit);
    } else if (isVideo) {
        return _processVideo(filePath, originalPath, thumbnailPath, compressedPath, imgBuffer, isPath);
    } else {
        throw new Error(`Unsupported File ${fType.ext}`);
    }
}

export async function _calculateThumbnail(binary: Buffer, thumbnailPath: string, width: number, height?: number) {
    const startDate = new Date();
    const file = `${thumbnailPath}.jpg`;
    // 108, 170 -> 150 x 236
    const result = await sharp(binary).rotate().resize(width, height).jpeg({
        quality: 50,
        chromaSubsampling: '4:4:4',
        // trellisQuantisation: true,
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

export async function _writeFile(filePath: string, binary: Buffer, isPath?: boolean) {
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

export async function getRoundImages(req: Request, res: Response, next: NextFunction) {
    const eventId = req.params.eventId;
    const roundNumber = parseInt(req.params.roundNo);
    const event = await EventModel.findById(eventId)
        .select(['Rounds', 'CurrentRound', 'EID', 'EnableAuction'])
        .populate('Rounds.Contestants.Detail');
    if (!event) {
        next({
            status: 403,
            message: `Invalid event Id ${eventId}`
        });
        return ;
    }
    const currentRound = event.CurrentRound && event.CurrentRound.RoundNumber;
    for ( let j = 0; j < event.Rounds.length; j++ ) {
        if (event.Rounds[j].RoundNumber === roundNumber) {
            const artistImages = artistWiseImages(event.Rounds[j].Contestants);
            const response: RoundArtistsInterface = {
                EventId: eventId,
                RoundNumber: roundNumber,
                Artists: artistImages.artists,
                IsCurrentRound: currentRound === roundNumber,
                HasOpenRound: !event.Rounds[j].IsFinished,
                HasImages: artistImages.hasImages,
                EID: event.EID || '',
                EnableAuction: event.EnableAuction
            };
            const operationResult: DataOperationResult<RoundArtistsInterface> = {
                Success: true,
                Data: response
            };
            res.json(operationResult);
            return ;
        }
    }
    next({
        status: 403,
        message: `No matching round ${roundNumber} found in ${eventId}`
    });
}

export async function getMediaId(req: Request, res: Response, next: NextFunction) {
    try {
        const registration = await RegistrationModel.findOne({
            Hash: req.params.hash
        });
        if (!registration) {
            res.status(403);
            res.json({
                Message: `Invalid user hash ${req.params.hash}`
            });
            return ;
        }
        const baseIdObj = req.body;
        const fileExtension = mime.extension(baseIdObj.fileType);
        if (!fileExtension) {
            next({
                status: 400,
                message: `Unsupported file type ${baseIdObj.fileType}`
            });
            return ;
        }
        let fileType;
        if (imageExtensions.indexOf(fileExtension) > -1) {
            fileType = 'photo';
        } else if (videoExtensions.indexOf(fileExtension) > -1) {
            fileType = 'video';
        }
        if (!fileExtension) {
            next({
                status: 400,
                message: `Unsupported file type ${fileExtension}`
            });
            return ;
        }
        const media = new MediaModel({
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
        logger.info(`baseIdObj ${JSON.stringify(baseIdObj)}`);
        res.json(baseIdObj);
    } catch (e) {
        next(e);
    }
}

export async function resumableUpload(req: Request, res: Response, next: NextFunction) {
    try {
        const {validation, outputFileName} = await resumable.post(req);
        if (validation === 'done') {
            res.json({status: validation, outputFileName: outputFileName});
        } else {
            res.json({status: validation});
        }
    } catch (e) {
        console.error(e);
        next(e);
    }
}


export async function checkUpload(req: Request, res: Response, next: NextFunction) {
    try {
        const {status} = await resumable.get(req);
        res.status(status ? 200 : 404);
        res.json(status);
    } catch (e) {
        next(e);
    }
}

export async function linkUpload(req: Request, res: Response, next: NextFunction) {
    try {
        const body = req.body;
        body.mediaInEvent = await _uploadDoc(req, body.hash, body.eventId, body.roundNumber, body.contestantId,
            body.outputFileName, false, null, body.MediaId);
        res.json(body);
    } catch (e) {
        next(e);
    }
}

export async function _processVideo(filePath: string, originalPath: string, thumbnailPath: string,
                                    compressedPath: string, imgBuffer: Buffer, isPath: boolean) {
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

export async function _processImage(filePath: string, originalPath: string, thumbnailPath: string,
                                    compressedPath: string, imgBuffer: Buffer, isPath: boolean, edit: boolean) {
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
        thumbFile: result[1]. file,
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