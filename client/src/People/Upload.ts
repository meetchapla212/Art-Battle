import RequestQueueDTO from '../../../shared/RequestQueueDTO';
import * as ko from 'knockout';
import { Request } from '../Utils/GatewayFunctions';
import { BusyTracker } from '../Utils/BusyTracker';
// @ts-ignore
import Resumable from 'resumablejs';

export class Upload {
    public LoadingTracker: BusyTracker = new BusyTracker();
    public success: KnockoutObservable<boolean> = ko.observable<boolean>(true);
    public busy: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public percentage: KnockoutObservable<number> = ko.observable<number>(0);
    public RequestQueue: KnockoutObservableArray<RequestQueueDTO> = ko.observableArray<RequestQueueDTO>();
    public NumRequests: KnockoutObservable<number> = ko.observable<number>(0);
    public beforeUnloadPrompt: KnockoutObservable<string> = ko.observable<string>();
    public totalUploads: KnockoutObservable<number> = ko.observable<number>(0);
    public uploadId: string;
    public uploadManager: Resumable;
    public uploadIndexMap: {[key: string]: number} = {};
    public RequestArr: KnockoutObservableArray<number> = ko.observableArray<number>([]);

    constructor(uploadId: string, linkMedia: any) {
        this.uploadId = uploadId;
        this.uploadManager = new Resumable(
            {
                // @ts-ignore
                target: mp + '/api/gallery/upload',
                // simultaneousUploads: 1,
                generateUniqueIdentifier: this.generateId.bind(this),
                chunkSize: 1024 * 512
            }
        );
        const me = this;
        // Handle file add event
        this.uploadManager.on('fileAdded', function(file: any) {
            file.index = 0;
            const newIndex = me.RequestArr().push(0);
            me.uploadIndexMap[file.file.uniqueIdentifier] = newIndex - 1;
            // me.totalUploads(me.totalUploads() + files.length);
            me.uploadManager.upload();
        });
        this.uploadManager.on('fileProgress', function(file: any) {
            const progress = file.progress();
            me.RequestArr()[me.uploadIndexMap[file.file.uniqueIdentifier]] = Math.floor(progress * 100);
            me.RequestArr(me.RequestArr());
            // me.percentage(Math.floor((file.progress() / (me.totalUploads())) * 100));
            // Handle progress for both the file and the overall upload
            // $('.resumable-file-'+file.uniqueIdentifier+' .resumable-file-progress').html(Math.floor(file.progress()*100) + '%');
            // $('.progress-bar').css({width:Math.floor(r.progress()*100) + '%'});
        });
        this.uploadManager.on('fileSuccess', function(file: any, messageStr: string) {
            // Reflect that the file upload has completed
            const message: {status: string; outputFileName: string} = JSON.parse(messageStr);
            me.uploadManager.removeFile(file);
            const fileName = message.outputFileName;
            linkMedia(fileName, file.file.uniqueIdentifier).then(() => {
                me._updateProgress(file.file.uniqueIdentifier);
            }).catch((e: any) => {
                console.error(e);
                me._updateProgress(file.file.uniqueIdentifier);
            });
        });
        this.uploadManager.on('fileError', function(file: any, message: any) {
            alert(message);
            me._updateProgress(file.file.uniqueIdentifier);
            // Reflect that the file upload has resulted in error
            // $('.resumable-file-'+file.uniqueIdentifier+' .resumable-file-progress').html('(file could not be uploaded: '+message+')');
        });
        this.uploadManager.on('pause', function() {
            // Show resume, hide pause
            // console.log('pause');
        });
        this.uploadManager.on('complete', function() {
            // Hide pause/resume when the upload has completed
            console.log('complete');
            // me.RequestArr([]);
        });
        this.uploadManager.on('cancel', function() {
            console.log('cancel');
            // $('.resumable-file-progress').html('canceled');
        });
        this.uploadManager.on('uploadStart', function() {
            console.log('uploadStart');
            // Show pause, hide resume
            // $('.resumable-progress .progress-resume-link').hide();
            // $('.resumable-progress .progress-pause-link').show();
        });
    }

    public VotingUpdater: BusyTracker = new BusyTracker();

    uploadCb (rq: RequestQueueDTO) {
        let indexOfRq = -1;
        for (let i = 0; i < this.RequestQueue().length; i++) {
            if (this.RequestQueue()[i].ImageId === rq.ImageId) {
                indexOfRq = i;
                break;
            }
        }
        if (indexOfRq === -1) {
            indexOfRq = this.RequestQueue().length;
            this.RequestQueue()[indexOfRq] = rq;
            this.totalUploads(this.totalUploads() + 1);
        } else {
            this.RequestQueue()[indexOfRq] = rq;
        }
        this._updateProgress(''); // ToDO id
    }

    private _updateProgress(id: string) {
        let i = this.RequestQueue().length;
        let sumProgress = 0;
        let numUploads = 0;
        while (i--) {
            const rq = this.RequestQueue()[i];
            if (rq.Progress === -1) {
                // request is processed
                this.RequestQueue().splice(i, 1);
            } else {
                sumProgress = sumProgress + rq.Progress;
                numUploads++;
            }
        }
        if (numUploads === 0) {
            this.totalUploads(0);
            setTimeout(this.NumRequests, 2000, 0);
        }
        else {
            this.NumRequests(numUploads);
        }

        const pendingUploads: number = this.totalUploads() - numUploads;
        if (this.totalUploads() > 0) {
            this.percentage(((pendingUploads) / (this.totalUploads())) * 100 );
            // this.percentage(this.totalUploads());
            this.beforeUnloadPrompt = ko.observable(`Are you sure? Your ${numUploads} file(s) are uploading.`);
        } else {
            this.percentage(100);
            setTimeout(this.percentage, 2000, 0);
            this.beforeUnloadPrompt(null);
        }
    }

    async generateId(file: any) {
        const baseId = this.uploadId;
        const baseIdObj = {
            prefixId: baseId,
            fileType: file.type
        };
        // @ts-ignore
        const result = await this.LoadingTracker.AddOperation(Request(`${mp}/api/gallery/getMediaId`, 'POST', baseIdObj));
        return JSON.stringify(result);
    }

    public async syncFile(_uploadToServer: (arg0: (percentage: number) => void) => void, dto: any) {
        const time = new Date().getTime();
        try {
            this.busy(true); // image is uploading
            this.busy.notifySubscribers();
            if (this.uploadCb) {
                this.uploadCb({
                    Progress: 0,
                    ImageId:  time
                });
            }
            const result = await _uploadToServer((percentage: number) => {
                if (this.uploadCb) {
                    this.uploadCb({
                        Progress: percentage,
                        ImageId:  time
                    });
                }
            });
            if (this.uploadCb) {
                this.uploadCb({
                    Progress: -1,
                    ImageId:  time
                });
            }
            this.busy(false); // voting done
            return result;
        }
        catch (e) {
            alert(e && e.message || 'Upload failed due to click on external link');
            console.error('error in the image upload', e, e.message);
            // TODO notify parent for displaying error message
            if (this.uploadCb) {
                this.uploadCb({
                    Progress: -1,
                    ImageId:  time
                });
            }
        }
    }
}