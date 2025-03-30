(function (ko$1) {
    'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    var BusyTracker = /** @class */ (function () {
        function BusyTracker() {
            this._tasks = ko.observableArray();
            this._operations = ko.observableArray();
            this.ConfigureDependentObservables();
        }
        BusyTracker.prototype.ConfigureDependentObservables = function () {
            var _this = this;
            this.Busy = ko.computed({
                owner: this,
                read: function () {
                    return _this._tasks().length + _this._operations().length > 0;
                }
            });
        };
        BusyTracker.prototype.AddTask = function (task) {
            /// <param name="task" type="String">
            /// Identifies the task being performed that is keeping the tracker busy
            /// </param>
            if (!this._tasks().contains(task)) {
                this._tasks.push(task);
            }
        };
        BusyTracker.prototype.AddOperations = function (operations) {
            var _this = this;
            /// <param name="operations" type="Array">
            /// </param>
            operations.forEach(function (operation) {
                _this.AddOperation(operation);
            });
        };
        BusyTracker.prototype.AddOperation = function (operation) {
            return __awaiter(this, void 0, Promise, function () {
                var existingOperation;
                var _this = this;
                return __generator(this, function (_a) {
                    existingOperation = ko.utils.arrayFirst(this._operations(), function (listOperation) {
                        return listOperation === operation;
                    }, this);
                    if (existingOperation == null) {
                        this._operations.push(operation);
                        operation.then(function () {
                            _this._operations.remove(operation);
                        }).catch(function (e) {
                            console.error(e);
                            _this._operations.remove(operation);
                        });
                    }
                    return [2 /*return*/, operation];
                });
            });
        };
        BusyTracker.prototype.TaskComplete = function (task) {
            /// <param name="task" type="String">
            /// </param>
            if (this._tasks().contains(task)) {
                this._tasks.remove(task);
            }
        };
        BusyTracker.prototype.ClearTasks = function () {
            this._tasks.removeAll();
        };
        BusyTracker.prototype.HasTask = function (taskName) {
            /// <param name="taskName" type="String">
            /// </param>
            /// <returns type="Boolean"></returns>
            return this._tasks().contains(taskName);
        };
        return BusyTracker;
    }());

    // export function MakeRequestGeneric<T>(url: string, method: 'GET' | 'PUT' | 'POST' | 'DELETE', data?: Object): JQueryPromise<T> {
    //     options.dataType = 'json';
    //     options.contentType = 'application/json';
    //     options.type = method;
    //     XMLHttpRequest; xhr = new XMLHttpRequest();
    //     return request;
    // }
    function Request(url, method, data, progressCb, token) {
        return __awaiter(this, void 0, Promise, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var xhr = new XMLHttpRequest();
                        xhr.addEventListener('progress', function (evt) {
                            if (evt.lengthComputable) {
                                var percentComplete = evt.loaded / evt.total;
                                if (progressCb instanceof Function) {
                                    progressCb(percentComplete);
                                }
                            }
                        }, false);
                        xhr.onreadystatechange = function (event) {
                            if (xhr.readyState !== 4)
                                return;
                            if (xhr.status >= 200 && xhr.status < 300) {
                                resolve(JSON.parse(xhr.response)); // OK
                            }
                            else {
                                // Error
                                try {
                                    reject(JSON.parse(xhr.response));
                                }
                                catch (e) {
                                    reject({
                                        message: xhr.statusText + xhr.response,
                                        status: xhr.status,
                                        code: 'internal_err'
                                    });
                                }
                            }
                        };
                        xhr.open(method, url, true); // Async
                        xhr.setRequestHeader('Content-Type', 'application/json');
                        if (token && token.length > 0) {
                            xhr.setRequestHeader('Authorization', "Bearer " + token);
                        }
                        data ? xhr.send(JSON.stringify(data)) : xhr.send();
                    })];
            });
        });
    }

    var ArtistCombined = /** @class */ (function () {
        function ArtistCombined(dto, ArtistId, EaselNumber, EventId, RoundNumber, VoterHash, isNew, vm) {
            this.FileType = ko$1.observable();
            this.Thumbnail = ko$1.observable();
            this.Compressed = ko$1.observable();
            this.Original = ko$1.observable();
            this.Style = ko$1.observable();
            this.ArtistId = ArtistId;
            this.EaselNumber = EaselNumber;
            this.EventId = EventId;
            this.RoundNumber = RoundNumber;
            this.FileType(dto.FileType);
            this.VoterHash = VoterHash;
            if (this.FileType() === 'video') {
                this.Thumbnail({
                    url: '/images/video_icon.svg',
                    id: 'none'
                });
                this.Style('isVideo');
            }
            else {
                this.Thumbnail(dto.Thumbnail);
            }
            this.Original(dto.Original);
            this.Compressed(dto.Compressed);
            this.vm = vm;
        }
        ArtistCombined.prototype.Download = function () {
            window.location.href = this.Original().url;
        };
        return ArtistCombined;
    }());

    var Artist = /** @class */ (function () {
        function Artist(dto, EventId, Round, VoterHash, vm) {
            this.Images = ko.observableArray();
            this.Videos = ko.observableArray();
            this.Combined = ko.observableArray();
            this.showDialog = ko.observable(false);
            this.Name = dto.Name;
            this.EaselNumber = dto.EaselNumber;
            this.id = dto.id;
            this.EventId = EventId;
            this.RoundNumber = Round.RoundNumber();
            this.VoterHash = VoterHash;
            for (var i = 0; i < dto.Combined.length; i++) {
                this.Combined().unshift(new ArtistCombined(dto.Combined[i], this.id, this.EaselNumber, this.EventId, this.RoundNumber, this.VoterHash, false, vm));
            }
            this.showDialog = ko.observable(false);
            this.EID = vm.EID;
            this.vm = vm;
            this.Round = Round;
        }
        Artist.prototype.AddMedia = function (media) {
            var artistImage = new ArtistCombined(media, this.id, this.EaselNumber, this.EventId, this.RoundNumber, this.VoterHash, false, this.vm);
            this.Combined.unshift(artistImage);
        };
        Artist.prototype.fileUpload = function (Artist, e) {
            e.preventDefault();
            if (this.vm.RequestArr().length >= 3) {
                // do not allow more than 3 uploads simultaneously
                alert('Maximum of 3 files can be uploaded simultaneously');
                return;
            }
            var files = e.target.files;
            if (files.length > 1) {
                alert('Please select only one file');
                return;
            }
            this.vm.selectedEaselNumber(this.EaselNumber);
            this.vm.selectedArtistName(this.Name.join('').replace(/ /g, ''));
            this.vm.selectedContestantId(this.id);
            this.vm.eventId(this.EventId);
            this.vm.SelectedRound(this.Round);
            this.vm.uploadManager.addFile(files[0]);
            // @ts-ignore
            // this.vm.uploadManager.addFiles(files);
        };
        return Artist;
    }());

    var Round = /** @class */ (function () {
        function Round(obj, vm) {
            var _this = this;
            this.LoadingTracker = new BusyTracker();
            this.VoterHash = ko$1.observable();
            this.vote = ko$1.observable();
            this.message = ko$1.observable('');
            this.success = ko$1.observable(true);
            this.busy = ko$1.observable(false);
            this.selectedEaselNumber = ko$1.observable();
            this.Artists = ko$1.observableArray();
            this.EventId = ko$1.observable();
            this.RoundNumber = ko$1.observable();
            this.IsActive = ko$1.observable();
            this.DisplayVoting = ko$1.observable(false);
            this.IsCurrentRound = ko$1.observable();
            this.HasOpenRound = ko$1.observable();
            this.RoundText = ko$1.observable('');
            this.RoundWiseImagesUpdater = new BusyTracker();
            this.Show = ko$1.observable(false);
            this.HasImages = ko$1.observable(true);
            this.VotingCss = ko$1.computed(function () {
                if (_this.message().length === 0) {
                    return 'btn-info';
                }
                else if (_this.success()) {
                    return 'btn-success';
                }
                else {
                    return 'btn-danger';
                }
            });
            this.VotingText = ko$1.computed(function () {
                if (_this.message().length > 0) {
                    if (_this.success()) {
                        return 'SENT!';
                    }
                    else {
                        return 'Failed!';
                    }
                }
                return 'VOTE';
            });
            this.RoundCss = ko$1.computed(function () {
                var css = '';
                if (_this.IsCurrentRound()) {
                    _this.RoundText('VOTING OPEN');
                    _this.DisplayVoting(true);
                    css += ' open';
                }
                else {
                    if (_this.HasOpenRound()) {
                        _this.RoundText('OPEN soon');
                        css += ' soon';
                    }
                    else {
                        _this.RoundText('Voting Closed');
                        css += 'done';
                    }
                }
                return css;
            });
            this.RoundWrapperCss = ko$1.computed(function () {
                if (_this.IsActive()) {
                    return ' activeRound';
                }
                else {
                    return '';
                }
            });
            this.MessageCss = ko$1.computed(function () {
                if (_this.message().length > 0) {
                    if (_this.success()) {
                        return 'text-success inline';
                    }
                    else {
                        return 'text-danger inline';
                    }
                }
                else {
                    return 'text-success';
                }
            });
            this.VotingUpdater = new BusyTracker();
            this.EventId(obj.EventId);
            this.VoterHash(obj.VoterHash);
            this.RoundNumber(obj.RoundNumber);
            for (var i = 0; i < obj.Artists.length; i++) {
                this.Artists.push(new Artist(obj.Artists[i], this.EventId(), this, this.VoterHash(), vm));
            }
            this.VoterHash(obj.VoterHash);
            this.IsCurrentRound(obj.IsCurrentRound);
            this.HasOpenRound(obj.HasOpenRound);
            this.IsActive(obj.IsActive);
            this.HasImages(obj.HasImages);
            this.vm = vm;
        }
        Round.prototype.handleVotingForm = function (form) {
            return __awaiter(this, void 0, void 0, function () {
                var hashInput, voteInput, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!(form && this.selectedEaselNumber() !== undefined)) return [3 /*break*/, 2];
                            hashInput = form.querySelector('input[name=hash]');
                            voteInput = form.querySelector('input[name=vote]');
                            this.busy(true); // voting is going on
                            this.busy.notifySubscribers();
                            return [4 /*yield*/, this.VotingUpdater.AddOperation(Request(mp + "/api/vote/" + this.RoundNumber() + "/" + voteInput.value + "/" + hashInput.value, 'GET'))];
                        case 1:
                            result = _a.sent();
                            this.busy(false); // voting done
                            this.message('<span>' + result.Data + '</span>');
                            this.success(result.Success);
                            this.busy.notifySubscribers();
                            this.success.notifySubscribers();
                            this.message.notifySubscribers();
                            return [3 /*break*/, 3];
                        case 2:
                            this.message('Please select a picture to vote');
                            this.success(false);
                            _a.label = 3;
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        Round.prototype.clearButtonState = function () {
            this.busy(false);
            this.success(true);
            this.message('');
            this.busy.notifySubscribers();
            this.success.notifySubscribers();
            this.message.notifySubscribers();
        };
        Round.prototype.setEaselNumber = function (easelNumber, target, vm) {
            this.selectedEaselNumber(easelNumber);
            $('.artist-container').removeClass('active');
            if (vm.Images().length > 0) {
                $(target).addClass('active');
            }
        };
        Round.prototype.setStatus = function (isActive) {
            this.IsActive(isActive);
        };
        Round.prototype.getArtistsWiseImages = function () {
            return __awaiter(this, void 0, void 0, function () {
                var result, artists, i, e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            this.busy(true); // fetching artist images
                            this.busy.notifySubscribers();
                            return [4 /*yield*/, this.RoundWiseImagesUpdater.AddOperation(Request(
                                // @ts-ignore
                                mp + "/api/gallery/" + this.EventId() + "/round/" + this.RoundNumber(), 'GET'))];
                        case 1:
                            result = _a.sent();
                            this.busy(false); // voting done
                            if (result.Success) {
                                artists = [];
                                this.IsCurrentRound(result.Data.IsCurrentRound);
                                this.HasOpenRound(result.Data.HasOpenRound);
                                this.HasImages(result.Data.HasImages);
                                for (i = 0; i < result.Data.Artists.length; i++) {
                                    artists.push(new Artist(result.Data.Artists[i], this.EventId(), this, this.VoterHash(), this.vm));
                                }
                                this.Artists(artists);
                            }
                            return [3 /*break*/, 3];
                        case 2:
                            e_1 = _a.sent();
                            console.error('error in fetching the images', e_1, e_1.message);
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        return Round;
    }());

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var resumable = createCommonjsModule(function (module) {
    /*
    * MIT Licensed
    * http://www.23developer.com/opensource
    * http://github.com/23/resumable.js
    * Steffen Tiedemann Christensen, steffen@23company.com
    */

    (function(){

      var Resumable = function(opts){
        if ( !(this instanceof Resumable) ) {
          return new Resumable(opts);
        }
        this.version = 1.0;
        // SUPPORTED BY BROWSER?
        // Check if these features are support by the browser:
        // - File object type
        // - Blob object type
        // - FileList object type
        // - slicing files
        this.support = (
                       (typeof(File)!=='undefined')
                       &&
                       (typeof(Blob)!=='undefined')
                       &&
                       (typeof(FileList)!=='undefined')
                       &&
                       (!!Blob.prototype.webkitSlice||!!Blob.prototype.mozSlice||!!Blob.prototype.slice||false)
                       );
        if(!this.support) return(false);


        // PROPERTIES
        var $ = this;
        $.files = [];
        $.defaults = {
          chunkSize:1*1024*1024,
          forceChunkSize:false,
          simultaneousUploads:3,
          fileParameterName:'file',
          chunkNumberParameterName: 'resumableChunkNumber',
          chunkSizeParameterName: 'resumableChunkSize',
          currentChunkSizeParameterName: 'resumableCurrentChunkSize',
          totalSizeParameterName: 'resumableTotalSize',
          typeParameterName: 'resumableType',
          identifierParameterName: 'resumableIdentifier',
          fileNameParameterName: 'resumableFilename',
          relativePathParameterName: 'resumableRelativePath',
          totalChunksParameterName: 'resumableTotalChunks',
          throttleProgressCallbacks: 0.5,
          query:{},
          headers:{},
          preprocess:null,
          method:'multipart',
          uploadMethod: 'POST',
          testMethod: 'GET',
          prioritizeFirstAndLastChunk:false,
          target:'/',
          testTarget: null,
          parameterNamespace:'',
          testChunks:true,
          generateUniqueIdentifier:null,
          getTarget:null,
          maxChunkRetries:100,
          chunkRetryInterval:undefined,
          permanentErrors:[400, 404, 415, 500, 501],
          maxFiles:undefined,
          withCredentials:false,
          xhrTimeout:0,
          clearInput:true,
          chunkFormat:'blob',
          setChunkTypeFromFile:false,
          maxFilesErrorCallback:function (files, errorCount) {
            var maxFiles = $.getOpt('maxFiles');
            alert('Please upload no more than ' + maxFiles + ' file' + (maxFiles === 1 ? '' : 's') + ' at a time.');
          },
          minFileSize:1,
          minFileSizeErrorCallback:function(file, errorCount) {
            alert(file.fileName||file.name +' is too small, please upload files larger than ' + $h.formatSize($.getOpt('minFileSize')) + '.');
          },
          maxFileSize:undefined,
          maxFileSizeErrorCallback:function(file, errorCount) {
            alert(file.fileName||file.name +' is too large, please upload files less than ' + $h.formatSize($.getOpt('maxFileSize')) + '.');
          },
          fileType: [],
          fileTypeErrorCallback: function(file, errorCount) {
            alert(file.fileName||file.name +' has type not allowed, please upload files of type ' + $.getOpt('fileType') + '.');
          }
        };
        $.opts = opts||{};
        $.getOpt = function(o) {
          var $opt = this;
          // Get multiple option if passed an array
          if(o instanceof Array) {
            var options = {};
            $h.each(o, function(option){
              options[option] = $opt.getOpt(option);
            });
            return options;
          }
          // Otherwise, just return a simple option
          if ($opt instanceof ResumableChunk) {
            if (typeof $opt.opts[o] !== 'undefined') { return $opt.opts[o]; }
            else { $opt = $opt.fileObj; }
          }
          if ($opt instanceof ResumableFile) {
            if (typeof $opt.opts[o] !== 'undefined') { return $opt.opts[o]; }
            else { $opt = $opt.resumableObj; }
          }
          if ($opt instanceof Resumable) {
            if (typeof $opt.opts[o] !== 'undefined') { return $opt.opts[o]; }
            else { return $opt.defaults[o]; }
          }
        };

        // EVENTS
        // catchAll(event, ...)
        // fileSuccess(file), fileProgress(file), fileAdded(file, event), filesAdded(files, filesSkipped), fileRetry(file),
        // fileError(file, message), complete(), progress(), error(message, file), pause()
        $.events = [];
        $.on = function(event,callback){
          $.events.push(event.toLowerCase(), callback);
        };
        $.fire = function(){
          // `arguments` is an object, not array, in FF, so:
          var args = [];
          for (var i=0; i<arguments.length; i++) args.push(arguments[i]);
          // Find event listeners, and support pseudo-event `catchAll`
          var event = args[0].toLowerCase();
          for (var i=0; i<=$.events.length; i+=2) {
            if($.events[i]==event) $.events[i+1].apply($,args.slice(1));
            if($.events[i]=='catchall') $.events[i+1].apply(null,args);
          }
          if(event=='fileerror') $.fire('error', args[2], args[1]);
          if(event=='fileprogress') $.fire('progress');
        };


        // INTERNAL HELPER METHODS (handy, but ultimately not part of uploading)
        var $h = {
          stopEvent: function(e){
            e.stopPropagation();
            e.preventDefault();
          },
          each: function(o,callback){
            if(typeof(o.length)!=='undefined') {
              for (var i=0; i<o.length; i++) {
                // Array or FileList
                if(callback(o[i])===false) return;
              }
            } else {
              for (i in o) {
                // Object
                if(callback(i,o[i])===false) return;
              }
            }
          },
          generateUniqueIdentifier:function(file, event){
            var custom = $.getOpt('generateUniqueIdentifier');
            if(typeof custom === 'function') {
              return custom(file, event);
            }
            var relativePath = file.webkitRelativePath||file.fileName||file.name; // Some confusion in different versions of Firefox
            var size = file.size;
            return(size + '-' + relativePath.replace(/[^0-9a-zA-Z_-]/img, ''));
          },
          contains:function(array,test) {
            var result = false;

            $h.each(array, function(value) {
              if (value == test) {
                result = true;
                return false;
              }
              return true;
            });

            return result;
          },
          formatSize:function(size){
            if(size<1024) {
              return size + ' bytes';
            } else if(size<1024*1024) {
              return (size/1024.0).toFixed(0) + ' KB';
            } else if(size<1024*1024*1024) {
              return (size/1024.0/1024.0).toFixed(1) + ' MB';
            } else {
              return (size/1024.0/1024.0/1024.0).toFixed(1) + ' GB';
            }
          },
          getTarget:function(request, params){
            var target = $.getOpt('target');

            if (request === 'test' && $.getOpt('testTarget')) {
              target = $.getOpt('testTarget') === '/' ? $.getOpt('target') : $.getOpt('testTarget');
            }

            if (typeof target === 'function') {
              return target(params);
            }

            var separator = target.indexOf('?') < 0 ? '?' : '&';
            var joinedParams = params.join('&');

            return target + separator + joinedParams;
          }
        };

        var onDrop = function(event){
          $h.stopEvent(event);

          //handle dropped things as items if we can (this lets us deal with folders nicer in some cases)
          if (event.dataTransfer && event.dataTransfer.items) {
            loadFiles(event.dataTransfer.items, event);
          }
          //else handle them as files
          else if (event.dataTransfer && event.dataTransfer.files) {
            loadFiles(event.dataTransfer.files, event);
          }
        };
        var preventDefault = function(e) {
          e.preventDefault();
        };

        /**
         * processes a single upload item (file or directory)
         * @param {Object} item item to upload, may be file or directory entry
         * @param {string} path current file path
         * @param {File[]} items list of files to append new items to
         * @param {Function} cb callback invoked when item is processed
         */
        function processItem(item, path, items, cb) {
          var entry;
          if(item.isFile){
            // file provided
            return item.file(function(file){
              file.relativePath = path + file.name;
              items.push(file);
              cb();
            });
          }else if(item.isDirectory){
            // item is already a directory entry, just assign
            entry = item;
          }else if(item instanceof File) {
            items.push(item);
          }
          if('function' === typeof item.webkitGetAsEntry){
            // get entry from file object
            entry = item.webkitGetAsEntry();
          }
          if(entry && entry.isDirectory){
            // directory provided, process it
            return processDirectory(entry, path + entry.name + '/', items, cb);
          }
          if('function' === typeof item.getAsFile){
            // item represents a File object, convert it
            item = item.getAsFile();
            if(item instanceof File) {
              item.relativePath = path + item.name;
              items.push(item);
            }
          }
          cb(); // indicate processing is done
        }


        /**
         * cps-style list iteration.
         * invokes all functions in list and waits for their callback to be
         * triggered.
         * @param  {Function[]}   items list of functions expecting callback parameter
         * @param  {Function} cb    callback to trigger after the last callback has been invoked
         */
        function processCallbacks(items, cb){
          if(!items || items.length === 0){
            // empty or no list, invoke callback
            return cb();
          }
          // invoke current function, pass the next part as continuation
          items[0](function(){
            processCallbacks(items.slice(1), cb);
          });
        }

        /**
         * recursively traverse directory and collect files to upload
         * @param  {Object}   directory directory to process
         * @param  {string}   path      current path
         * @param  {File[]}   items     target list of items
         * @param  {Function} cb        callback invoked after traversing directory
         */
        function processDirectory (directory, path, items, cb) {
          var dirReader = directory.createReader();
          dirReader.readEntries(function(entries){
            if(!entries.length){
              // empty directory, skip
              return cb();
            }
            // process all conversion callbacks, finally invoke own one
            processCallbacks(
              entries.map(function(entry){
                // bind all properties except for callback
                return processItem.bind(null, entry, path, items);
              }),
              cb
            );
          });
        }

        /**
         * process items to extract files to be uploaded
         * @param  {File[]} items items to process
         * @param  {Event} event event that led to upload
         */
        function loadFiles(items, event) {
          if(!items.length){
            return; // nothing to do
          }
          $.fire('beforeAdd');
          var files = [];
          processCallbacks(
              Array.prototype.map.call(items, function(item){
                // bind all properties except for callback
                return processItem.bind(null, item, "", files);
              }),
              function(){
                if(files.length){
                  // at least one file found
                  appendFilesFromFileList(files, event);
                }
              }
          );
        }
        var appendFilesFromFileList = function(fileList, event){
          // check for uploading too many files
          var errorCount = 0;
          var o = $.getOpt(['maxFiles', 'minFileSize', 'maxFileSize', 'maxFilesErrorCallback', 'minFileSizeErrorCallback', 'maxFileSizeErrorCallback', 'fileType', 'fileTypeErrorCallback']);
          if (typeof(o.maxFiles)!=='undefined' && o.maxFiles<(fileList.length+$.files.length)) {
            // if single-file upload, file is already added, and trying to add 1 new file, simply replace the already-added file
            if (o.maxFiles===1 && $.files.length===1 && fileList.length===1) {
              $.removeFile($.files[0]);
            } else {
              o.maxFilesErrorCallback(fileList, errorCount++);
              return false;
            }
          }
          var files = [], filesSkipped = [], remaining = fileList.length;
          var decreaseReamining = function(){
            if(!--remaining){
              // all files processed, trigger event
              if(!files.length && !filesSkipped.length){
                // no succeeded files, just skip
                return;
              }
              window.setTimeout(function(){
                $.fire('filesAdded', files, filesSkipped);
              },0);
            }
          };
          $h.each(fileList, function(file){
            var fileName = file.name;
            if(o.fileType.length > 0){
              var fileTypeFound = false;
              for(var index in o.fileType){
                var extension = '.' + o.fileType[index];
    			if(fileName.toLowerCase().indexOf(extension.toLowerCase(), fileName.length - extension.length) !== -1){
                  fileTypeFound = true;
                  break;
                }
              }
              if (!fileTypeFound) {
                o.fileTypeErrorCallback(file, errorCount++);
                return false;
              }
            }

            if (typeof(o.minFileSize)!=='undefined' && file.size<o.minFileSize) {
              o.minFileSizeErrorCallback(file, errorCount++);
              return false;
            }
            if (typeof(o.maxFileSize)!=='undefined' && file.size>o.maxFileSize) {
              o.maxFileSizeErrorCallback(file, errorCount++);
              return false;
            }

            function addFile(uniqueIdentifier){
              if (!$.getFromUniqueIdentifier(uniqueIdentifier)) {(function(){
                file.uniqueIdentifier = uniqueIdentifier;
                var f = new ResumableFile($, file, uniqueIdentifier);
                $.files.push(f);
                files.push(f);
                f.container = (typeof event != 'undefined' ? event.srcElement : null);
                window.setTimeout(function(){
                  $.fire('fileAdded', f, event);
                },0);
              })();} else {
                filesSkipped.push(file);
              }          decreaseReamining();
            }
            // directories have size == 0
            var uniqueIdentifier = $h.generateUniqueIdentifier(file, event);
            if(uniqueIdentifier && typeof uniqueIdentifier.then === 'function'){
              // Promise or Promise-like object provided as unique identifier
              uniqueIdentifier
              .then(
                function(uniqueIdentifier){
                  // unique identifier generation succeeded
                  addFile(uniqueIdentifier);
                },
               function(){
                  // unique identifier generation failed
                  // skip further processing, only decrease file count
                  decreaseReamining();
                }
              );
            }else {
              // non-Promise provided as unique identifier, process synchronously
              addFile(uniqueIdentifier);
            }
          });
        };

        // INTERNAL OBJECT TYPES
        function ResumableFile(resumableObj, file, uniqueIdentifier){
          var $ = this;
          $.opts = {};
          $.getOpt = resumableObj.getOpt;
          $._prevProgress = 0;
          $.resumableObj = resumableObj;
          $.file = file;
          $.fileName = file.fileName||file.name; // Some confusion in different versions of Firefox
          $.size = file.size;
          $.relativePath = file.relativePath || file.webkitRelativePath || $.fileName;
          $.uniqueIdentifier = uniqueIdentifier;
          $._pause = false;
          $.container = '';
          var _error = uniqueIdentifier !== undefined;

          // Callback when something happens within the chunk
          var chunkEvent = function(event, message){
            // event can be 'progress', 'success', 'error' or 'retry'
            switch(event){
            case 'progress':
              $.resumableObj.fire('fileProgress', $, message);
              break;
            case 'error':
              $.abort();
              _error = true;
              $.chunks = [];
              $.resumableObj.fire('fileError', $, message);
              break;
            case 'success':
              if(_error) return;
              $.resumableObj.fire('fileProgress', $); // it's at least progress
              if($.isComplete()) {
                $.resumableObj.fire('fileSuccess', $, message);
              }
              break;
            case 'retry':
              $.resumableObj.fire('fileRetry', $);
              break;
            }
          };

          // Main code to set up a file object with chunks,
          // packaged to be able to handle retries if needed.
          $.chunks = [];
          $.abort = function(){
            // Stop current uploads
            var abortCount = 0;
            $h.each($.chunks, function(c){
              if(c.status()=='uploading') {
                c.abort();
                abortCount++;
              }
            });
            if(abortCount>0) $.resumableObj.fire('fileProgress', $);
          };
          $.cancel = function(){
            // Reset this file to be void
            var _chunks = $.chunks;
            $.chunks = [];
            // Stop current uploads
            $h.each(_chunks, function(c){
              if(c.status()=='uploading')  {
                c.abort();
                $.resumableObj.uploadNextChunk();
              }
            });
            $.resumableObj.removeFile($);
            $.resumableObj.fire('fileProgress', $);
          };
          $.retry = function(){
            $.bootstrap();
            var firedRetry = false;
            $.resumableObj.on('chunkingComplete', function(){
              if(!firedRetry) $.resumableObj.upload();
              firedRetry = true;
            });
          };
          $.bootstrap = function(){
            $.abort();
            _error = false;
            // Rebuild stack of chunks from file
            $.chunks = [];
            $._prevProgress = 0;
            var round = $.getOpt('forceChunkSize') ? Math.ceil : Math.floor;
            var maxOffset = Math.max(round($.file.size/$.getOpt('chunkSize')),1);
            for (var offset=0; offset<maxOffset; offset++) {(function(offset){
                window.setTimeout(function(){
                    $.chunks.push(new ResumableChunk($.resumableObj, $, offset, chunkEvent));
                    $.resumableObj.fire('chunkingProgress',$,offset/maxOffset);
                },0);
            })(offset);}
            window.setTimeout(function(){
                $.resumableObj.fire('chunkingComplete',$);
            },0);
          };
          $.progress = function(){
            if(_error) return(1);
            // Sum up progress across everything
            var ret = 0;
            var error = false;
            $h.each($.chunks, function(c){
              if(c.status()=='error') error = true;
              ret += c.progress(true); // get chunk progress relative to entire file
            });
            ret = (error ? 1 : (ret>0.99999 ? 1 : ret));
            ret = Math.max($._prevProgress, ret); // We don't want to lose percentages when an upload is paused
            $._prevProgress = ret;
            return(ret);
          };
          $.isUploading = function(){
            var uploading = false;
            $h.each($.chunks, function(chunk){
              if(chunk.status()=='uploading') {
                uploading = true;
                return(false);
              }
            });
            return(uploading);
          };
          $.isComplete = function(){
            var outstanding = false;
            $h.each($.chunks, function(chunk){
              var status = chunk.status();
              if(status=='pending' || status=='uploading' || chunk.preprocessState === 1) {
                outstanding = true;
                return(false);
              }
            });
            return(!outstanding);
          };
          $.pause = function(pause){
              if(typeof(pause)==='undefined'){
                  $._pause = ($._pause ? false : true);
              }else {
                  $._pause = pause;
              }
          };
          $.isPaused = function() {
            return $._pause;
          };


          // Bootstrap and return
          $.resumableObj.fire('chunkingStart', $);
          $.bootstrap();
          return(this);
        }


        function ResumableChunk(resumableObj, fileObj, offset, callback){
          var $ = this;
          $.opts = {};
          $.getOpt = resumableObj.getOpt;
          $.resumableObj = resumableObj;
          $.fileObj = fileObj;
          $.fileObjSize = fileObj.size;
          $.fileObjType = fileObj.file.type;
          $.offset = offset;
          $.callback = callback;
          $.lastProgressCallback = (new Date);
          $.tested = false;
          $.retries = 0;
          $.pendingRetry = false;
          $.preprocessState = 0; // 0 = unprocessed, 1 = processing, 2 = finished

          // Computed properties
          var chunkSize = $.getOpt('chunkSize');
          $.loaded = 0;
          $.startByte = $.offset*chunkSize;
          $.endByte = Math.min($.fileObjSize, ($.offset+1)*chunkSize);
          if ($.fileObjSize-$.endByte < chunkSize && !$.getOpt('forceChunkSize')) {
            // The last chunk will be bigger than the chunk size, but less than 2*chunkSize
            $.endByte = $.fileObjSize;
          }
          $.xhr = null;

          // test() makes a GET request without any data to see if the chunk has already been uploaded in a previous session
          $.test = function(){
            // Set up request and listen for event
            $.xhr = new XMLHttpRequest();

            var testHandler = function(e){
              $.tested = true;
              var status = $.status();
              if(status=='success') {
                $.callback(status, $.message());
                $.resumableObj.uploadNextChunk();
              } else {
                $.send();
              }
            };
            $.xhr.addEventListener('load', testHandler, false);
            $.xhr.addEventListener('error', testHandler, false);
            $.xhr.addEventListener('timeout', testHandler, false);

            // Add data from the query options
            var params = [];
            var parameterNamespace = $.getOpt('parameterNamespace');
            var customQuery = $.getOpt('query');
            if(typeof customQuery == 'function') customQuery = customQuery($.fileObj, $);
            $h.each(customQuery, function(k,v){
              params.push([encodeURIComponent(parameterNamespace+k), encodeURIComponent(v)].join('='));
            });
            // Add extra data to identify chunk
            params = params.concat(
              [
                // define key/value pairs for additional parameters
                ['chunkNumberParameterName', $.offset + 1],
                ['chunkSizeParameterName', $.getOpt('chunkSize')],
                ['currentChunkSizeParameterName', $.endByte - $.startByte],
                ['totalSizeParameterName', $.fileObjSize],
                ['typeParameterName', $.fileObjType],
                ['identifierParameterName', $.fileObj.uniqueIdentifier],
                ['fileNameParameterName', $.fileObj.fileName],
                ['relativePathParameterName', $.fileObj.relativePath],
                ['totalChunksParameterName', $.fileObj.chunks.length]
              ].filter(function(pair){
                // include items that resolve to truthy values
                // i.e. exclude false, null, undefined and empty strings
                return $.getOpt(pair[0]);
              })
              .map(function(pair){
                // map each key/value pair to its final form
                return [
                  parameterNamespace + $.getOpt(pair[0]),
                  encodeURIComponent(pair[1])
                ].join('=');
              })
            );
            // Append the relevant chunk and send it
            $.xhr.open($.getOpt('testMethod'), $h.getTarget('test', params));
            $.xhr.timeout = $.getOpt('xhrTimeout');
            $.xhr.withCredentials = $.getOpt('withCredentials');
            // Add data from header options
            var customHeaders = $.getOpt('headers');
            if(typeof customHeaders === 'function') {
              customHeaders = customHeaders($.fileObj, $);
            }
            $h.each(customHeaders, function(k,v) {
              $.xhr.setRequestHeader(k, v);
            });
            $.xhr.send(null);
          };

          $.preprocessFinished = function(){
            $.preprocessState = 2;
            $.send();
          };

          // send() uploads the actual data in a POST call
          $.send = function(){
            var preprocess = $.getOpt('preprocess');
            if(typeof preprocess === 'function') {
              switch($.preprocessState) {
              case 0: $.preprocessState = 1; preprocess($); return;
              case 1: return;
              }
            }
            if($.getOpt('testChunks') && !$.tested) {
              $.test();
              return;
            }

            // Set up request and listen for event
            $.xhr = new XMLHttpRequest();

            // Progress
            $.xhr.upload.addEventListener('progress', function(e){
              if( (new Date) - $.lastProgressCallback > $.getOpt('throttleProgressCallbacks') * 1000 ) {
                $.callback('progress');
                $.lastProgressCallback = (new Date);
              }
              $.loaded=e.loaded||0;
            }, false);
            $.loaded = 0;
            $.pendingRetry = false;
            $.callback('progress');

            // Done (either done, failed or retry)
            var doneHandler = function(e){
              var status = $.status();
              if(status=='success'||status=='error') {
                $.callback(status, $.message());
                $.resumableObj.uploadNextChunk();
              } else {
                $.callback('retry', $.message());
                $.abort();
                $.retries++;
                var retryInterval = $.getOpt('chunkRetryInterval');
                if(retryInterval !== undefined) {
                  $.pendingRetry = true;
                  setTimeout($.send, retryInterval);
                } else {
                  $.send();
                }
              }
            };
            $.xhr.addEventListener('load', doneHandler, false);
            $.xhr.addEventListener('error', doneHandler, false);
            $.xhr.addEventListener('timeout', doneHandler, false);

            // Set up the basic query data from Resumable
            var query = [
              ['chunkNumberParameterName', $.offset + 1],
              ['chunkSizeParameterName', $.getOpt('chunkSize')],
              ['currentChunkSizeParameterName', $.endByte - $.startByte],
              ['totalSizeParameterName', $.fileObjSize],
              ['typeParameterName', $.fileObjType],
              ['identifierParameterName', $.fileObj.uniqueIdentifier],
              ['fileNameParameterName', $.fileObj.fileName],
              ['relativePathParameterName', $.fileObj.relativePath],
              ['totalChunksParameterName', $.fileObj.chunks.length],
            ].filter(function(pair){
              // include items that resolve to truthy values
              // i.e. exclude false, null, undefined and empty strings
              return $.getOpt(pair[0]);
            })
            .reduce(function(query, pair){
              // assign query key/value
              query[$.getOpt(pair[0])] = pair[1];
              return query;
            }, {});
            // Mix in custom data
            var customQuery = $.getOpt('query');
            if(typeof customQuery == 'function') customQuery = customQuery($.fileObj, $);
            $h.each(customQuery, function(k,v){
              query[k] = v;
            });

            var func = ($.fileObj.file.slice ? 'slice' : ($.fileObj.file.mozSlice ? 'mozSlice' : ($.fileObj.file.webkitSlice ? 'webkitSlice' : 'slice')));
            var bytes = $.fileObj.file[func]($.startByte, $.endByte, $.getOpt('setChunkTypeFromFile') ? $.fileObj.file.type : "");
            var data = null;
            var params = [];

            var parameterNamespace = $.getOpt('parameterNamespace');
                    if ($.getOpt('method') === 'octet') {
                        // Add data from the query options
                        data = bytes;
                        $h.each(query, function (k, v) {
                            params.push([encodeURIComponent(parameterNamespace + k), encodeURIComponent(v)].join('='));
                        });
                    } else {
                        // Add data from the query options
                        data = new FormData();
                        $h.each(query, function (k, v) {
                            data.append(parameterNamespace + k, v);
                            params.push([encodeURIComponent(parameterNamespace + k), encodeURIComponent(v)].join('='));
                        });
                        if ($.getOpt('chunkFormat') == 'blob') {
                            data.append(parameterNamespace + $.getOpt('fileParameterName'), bytes, $.fileObj.fileName);
                        }
                        else if ($.getOpt('chunkFormat') == 'base64') {
                            var fr = new FileReader();
                            fr.onload = function (e) {
                                data.append(parameterNamespace + $.getOpt('fileParameterName'), fr.result);
                                $.xhr.send(data);
                            };
                            fr.readAsDataURL(bytes);
                        }
                    }

            var target = $h.getTarget('upload', params);
            var method = $.getOpt('uploadMethod');

            $.xhr.open(method, target);
            if ($.getOpt('method') === 'octet') {
              $.xhr.setRequestHeader('Content-Type', 'application/octet-stream');
            }
            $.xhr.timeout = $.getOpt('xhrTimeout');
            $.xhr.withCredentials = $.getOpt('withCredentials');
            // Add data from header options
            var customHeaders = $.getOpt('headers');
            if(typeof customHeaders === 'function') {
              customHeaders = customHeaders($.fileObj, $);
            }

            $h.each(customHeaders, function(k,v) {
              $.xhr.setRequestHeader(k, v);
            });

                    if ($.getOpt('chunkFormat') == 'blob') {
                        $.xhr.send(data);
                    }
          };
          $.abort = function(){
            // Abort and reset
            if($.xhr) $.xhr.abort();
            $.xhr = null;
          };
          $.status = function(){
            // Returns: 'pending', 'uploading', 'success', 'error'
            if($.pendingRetry) {
              // if pending retry then that's effectively the same as actively uploading,
              // there might just be a slight delay before the retry starts
              return('uploading');
            } else if(!$.xhr) {
              return('pending');
            } else if($.xhr.readyState<4) {
              // Status is really 'OPENED', 'HEADERS_RECEIVED' or 'LOADING' - meaning that stuff is happening
              return('uploading');
            } else {
              if($.xhr.status == 200 || $.xhr.status == 201) {
                // HTTP 200, 201 (created)
                return('success');
              } else if($h.contains($.getOpt('permanentErrors'), $.xhr.status) || $.retries >= $.getOpt('maxChunkRetries')) {
                // HTTP 415/500/501, permanent error
                return('error');
              } else {
                // this should never happen, but we'll reset and queue a retry
                // a likely case for this would be 503 service unavailable
                $.abort();
                return('pending');
              }
            }
          };
          $.message = function(){
            return($.xhr ? $.xhr.responseText : '');
          };
          $.progress = function(relative){
            if(typeof(relative)==='undefined') relative = false;
            var factor = (relative ? ($.endByte-$.startByte)/$.fileObjSize : 1);
            if($.pendingRetry) return(0);
            if(!$.xhr || !$.xhr.status) factor*=.95;
            var s = $.status();
            switch(s){
            case 'success':
            case 'error':
              return(1*factor);
            case 'pending':
              return(0*factor);
            default:
              return($.loaded/($.endByte-$.startByte)*factor);
            }
          };
          return(this);
        }

        // QUEUE
        $.uploadNextChunk = function(){
          var found = false;

          // In some cases (such as videos) it's really handy to upload the first
          // and last chunk of a file quickly; this let's the server check the file's
          // metadata and determine if there's even a point in continuing.
          if ($.getOpt('prioritizeFirstAndLastChunk')) {
            $h.each($.files, function(file){
              if(file.chunks.length && file.chunks[0].status()=='pending' && file.chunks[0].preprocessState === 0) {
                file.chunks[0].send();
                found = true;
                return(false);
              }
              if(file.chunks.length>1 && file.chunks[file.chunks.length-1].status()=='pending' && file.chunks[file.chunks.length-1].preprocessState === 0) {
                file.chunks[file.chunks.length-1].send();
                found = true;
                return(false);
              }
            });
            if(found) return(true);
          }

          // Now, simply look for the next, best thing to upload
          $h.each($.files, function(file){
            if(file.isPaused()===false){
             $h.each(file.chunks, function(chunk){
               if(chunk.status()=='pending' && chunk.preprocessState === 0) {
                 chunk.send();
                 found = true;
                 return(false);
               }
              });
            }
            if(found) return(false);
          });
          if(found) return(true);

          // The are no more outstanding chunks to upload, check is everything is done
          var outstanding = false;
          $h.each($.files, function(file){
            if(!file.isComplete()) {
              outstanding = true;
              return(false);
            }
          });
          if(!outstanding) {
            // All chunks have been uploaded, complete
            $.fire('complete');
          }
          return(false);
        };


        // PUBLIC METHODS FOR RESUMABLE.JS
        $.assignBrowse = function(domNodes, isDirectory){
          if(typeof(domNodes.length)=='undefined') domNodes = [domNodes];

          $h.each(domNodes, function(domNode) {
            var input;
            if(domNode.tagName==='INPUT' && domNode.type==='file'){
              input = domNode;
            } else {
              input = document.createElement('input');
              input.setAttribute('type', 'file');
              input.style.display = 'none';
              domNode.addEventListener('click', function(){
                input.style.opacity = 0;
                input.style.display='block';
                input.focus();
                input.click();
                input.style.display='none';
              }, false);
              domNode.appendChild(input);
            }
            var maxFiles = $.getOpt('maxFiles');
            if (typeof(maxFiles)==='undefined'||maxFiles!=1){
              input.setAttribute('multiple', 'multiple');
            } else {
              input.removeAttribute('multiple');
            }
            if(isDirectory){
              input.setAttribute('webkitdirectory', 'webkitdirectory');
            } else {
              input.removeAttribute('webkitdirectory');
            }
            var fileTypes = $.getOpt('fileType');
            if (typeof (fileTypes) !== 'undefined' && fileTypes.length >= 1) {
              input.setAttribute('accept', fileTypes.map(function (e) { return '.' + e }).join(','));
            }
            else {
              input.removeAttribute('accept');
            }
            // When new files are added, simply append them to the overall list
            input.addEventListener('change', function(e){
              appendFilesFromFileList(e.target.files,e);
              var clearInput = $.getOpt('clearInput');
              if (clearInput) {
                e.target.value = '';
              }
            }, false);
          });
        };
        $.assignDrop = function(domNodes){
          if(typeof(domNodes.length)=='undefined') domNodes = [domNodes];

          $h.each(domNodes, function(domNode) {
            domNode.addEventListener('dragover', preventDefault, false);
            domNode.addEventListener('dragenter', preventDefault, false);
            domNode.addEventListener('drop', onDrop, false);
          });
        };
        $.unAssignDrop = function(domNodes) {
          if (typeof(domNodes.length) == 'undefined') domNodes = [domNodes];

          $h.each(domNodes, function(domNode) {
            domNode.removeEventListener('dragover', preventDefault);
            domNode.removeEventListener('dragenter', preventDefault);
            domNode.removeEventListener('drop', onDrop);
          });
        };
        $.isUploading = function(){
          var uploading = false;
          $h.each($.files, function(file){
            if (file.isUploading()) {
              uploading = true;
              return(false);
            }
          });
          return(uploading);
        };
        $.upload = function(){
          // Make sure we don't start too many uploads at once
          if($.isUploading()) return;
          // Kick off the queue
          $.fire('uploadStart');
          for (var num=1; num<=$.getOpt('simultaneousUploads'); num++) {
            $.uploadNextChunk();
          }
        };
        $.pause = function(){
          // Resume all chunks currently being uploaded
          $h.each($.files, function(file){
            file.abort();
          });
          $.fire('pause');
        };
        $.cancel = function(){
          $.fire('beforeCancel');
          for(var i = $.files.length - 1; i >= 0; i--) {
            $.files[i].cancel();
          }
          $.fire('cancel');
        };
        $.progress = function(){
          var totalDone = 0;
          var totalSize = 0;
          // Resume all chunks currently being uploaded
          $h.each($.files, function(file){
            totalDone += file.progress()*file.size;
            totalSize += file.size;
          });
          return(totalSize>0 ? totalDone/totalSize : 0);
        };
        $.addFile = function(file, event){
          appendFilesFromFileList([file], event);
        };
        $.addFiles = function(files, event){
          appendFilesFromFileList(files, event);
        };
        $.removeFile = function(file){
          for(var i = $.files.length - 1; i >= 0; i--) {
            if($.files[i] === file) {
              $.files.splice(i, 1);
            }
          }
        };
        $.getFromUniqueIdentifier = function(uniqueIdentifier){
          var ret = false;
          $h.each($.files, function(f){
            if(f.uniqueIdentifier==uniqueIdentifier) ret = f;
          });
          return(ret);
        };
        $.getSize = function(){
          var totalSize = 0;
          $h.each($.files, function(file){
            totalSize += file.size;
          });
          return(totalSize);
        };
        $.handleDropEvent = function (e) {
          onDrop(e);
        };
        $.handleChangeEvent = function (e) {
          appendFilesFromFileList(e.target.files, e);
          e.target.value = '';
        };
        $.updateQuery = function(query){
            $.opts.query = query;
        };

        return(this);
      };


      // Node.js-style export for Node and Component
      {
        module.exports = Resumable;
      }

    })();
    });

    var VotingScreenViewModel = /** @class */ (function () {
        function VotingScreenViewModel() {
            this.LoadingTracker = new BusyTracker();
            this.hash = ko$1.observable();
            this.VoterHash = ko$1.observable();
            this.vote = ko$1.observable();
            this.success = ko$1.observable(true);
            this.busy = ko$1.observable(false);
            this.selectedEaselNumber = ko$1.observable();
            this.selectedArtistName = ko$1.observable();
            this.Artists = ko$1.observableArray();
            this.RoundWiseImages = ko$1.observableArray();
            this.RoundNumber = ko$1.observable();
            this.CurrentRoundNumber = ko$1.observable();
            this.percentage = ko$1.observable(0);
            this.RequestQueue = ko$1.observableArray();
            this.RequestArr = ko$1.observableArray([]);
            this.beforeUnloadPrompt = ko$1.observable();
            // public totalUploads: KnockoutObservable<number> = ko.observable<number>(0);
            this.Rounds = ko$1.observableArray();
            this.selectedContestantId = ko$1.observable();
            this.SelectedRound = ko$1.observable();
            this.eventId = ko$1.observable();
            this.uploadIndexMap = {};
            this.VotingUpdater = new BusyTracker();
            /* coming from html */
            // @ts-ignore
            this.VoterHash(VoterHash);
            // @ts-ignore
            this.CurrentRoundNumber(CurrentRoundNumber);
            // @ts-ignore
            this.EID = EID;
            /* html end */
            this.uploadManager = new resumable({
                // @ts-ignore
                target: mp + '/api/gallery/upload',
                // simultaneousUploads: 1,
                generateUniqueIdentifier: this.generateId.bind(this),
                chunkSize: 1024 * 512
            });
            var me = this;
            // Handle file add event
            this.uploadManager.on('fileAdded', function (file) {
                file.index = 0;
                var newIndex = me.RequestArr().push(0);
                me.uploadIndexMap[file.file.uniqueIdentifier] = newIndex - 1;
                // me.totalUploads(me.totalUploads() + files.length);
                me.uploadManager.upload();
            });
            this.uploadManager.on('fileProgress', function (file) {
                var progress = file.progress();
                me.RequestArr()[me.uploadIndexMap[file.file.uniqueIdentifier]] = Math.floor(progress * 100);
                me.RequestArr(me.RequestArr());
                // me.percentage(Math.floor((file.progress() / (me.totalUploads())) * 100));
                // Handle progress for both the file and the overall upload
                // $('.resumable-file-'+file.uniqueIdentifier+' .resumable-file-progress').html(Math.floor(file.progress()*100) + '%');
                // $('.progress-bar').css({width:Math.floor(r.progress()*100) + '%'});
            });
            this.uploadManager.on('fileSuccess', function (file, messageStr) {
                // Reflect that the file upload has completed
                var message = JSON.parse(messageStr);
                me.uploadManager.removeFile(file);
                var fileName = message.outputFileName;
                me.linkMedia(fileName, file.file.uniqueIdentifier).then(function () {
                    me._updateProgress(file.file.uniqueIdentifier);
                }).catch(function (e) {
                    console.error(e);
                    me._updateProgress(file.file.uniqueIdentifier);
                });
            });
            this.uploadManager.on('fileError', function (file, message) {
                alert(message);
                me._updateProgress(file.file.uniqueIdentifier);
                // Reflect that the file upload has resulted in error
                // $('.resumable-file-'+file.uniqueIdentifier+' .resumable-file-progress').html('(file could not be uploaded: '+message+')');
            });
            this.uploadManager.on('pause', function () {
                // Show resume, hide pause
                // console.log('pause');
            });
            this.uploadManager.on('complete', function () {
                // Hide pause/resume when the upload has completed
                console.log('complete');
                // me.RequestArr([]);
            });
            this.uploadManager.on('cancel', function () {
                console.log('cancel');
                // $('.resumable-file-progress').html('canceled');
            });
            this.uploadManager.on('uploadStart', function () {
                console.log('uploadStart');
                // Show pause, hide resume
                // $('.resumable-progress .progress-resume-link').hide();
                // $('.resumable-progress .progress-pause-link').show();
            });
            // @ts-ignore
            this.RoundWiseImages(RoundWiseImages);
            for (var i = 0; i < this.RoundWiseImages().length; i++) {
                // this.RoundWiseImages()[i].uploadCb = this.uploadCb && this.uploadCb.bind(this);
                this.RoundWiseImages()[i].VoterHash = this.VoterHash();
                var roundObj = new Round(this.RoundWiseImages()[i], this);
                this.Rounds().push(roundObj);
                if (this.CurrentRoundNumber() === 0) {
                    // expand all if current round is not there
                    roundObj.Show(true);
                }
                if (this.RoundWiseImages()[i].RoundNumber === this.CurrentRoundNumber()) {
                    roundObj.setStatus(true);
                    roundObj.Show(true);
                    this.SelectedRound(roundObj);
                }
            }
        }
        VotingScreenViewModel.prototype.generateId = function (file) {
            return __awaiter(this, void 0, void 0, function () {
                var baseId, baseIdObj, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            baseId = eventName.replace(/[\W_]+/g, '') + "-" + this.SelectedRound().RoundNumber() + "-" + this.selectedEaselNumber() + "-" + this.selectedArtistName();
                            baseIdObj = {
                                // @ts-ignore
                                roundNumber: this.SelectedRound().RoundNumber(),
                                easelNumber: this.selectedEaselNumber(),
                                EID: this.EID,
                                prefixId: baseId,
                                hash: this.VoterHash(),
                                eventId: this.eventId(),
                                contestantId: this.selectedContestantId(),
                                fileType: file.type
                            };
                            return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(mp + "/api/gallery/getMediaId/" + this.VoterHash(), 'POST', baseIdObj))];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, JSON.stringify(result)];
                    }
                });
            });
        };
        VotingScreenViewModel.prototype.changeRound = function (vm) {
            return __awaiter(this, void 0, void 0, function () {
                var i;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.SelectedRound(vm);
                            // mark clicked round as active
                            vm.Show(!vm.Show());
                            for (i = 0; i < this.Rounds().length; i++) {
                                if (this.Rounds()[i].RoundNumber() !== vm.RoundNumber()) {
                                    // mark other rounds as inactive
                                    this.Rounds()[i].setStatus(false);
                                    // this.Rounds()[i].Show(!this.Rounds()[i].Show());
                                }
                            }
                            return [4 /*yield*/, vm.getArtistsWiseImages()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        VotingScreenViewModel.prototype.linkMedia = function (fileName, uniqueId) {
            return __awaiter(this, void 0, void 0, function () {
                var me, idObj, result, i, j, artist;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            me = this;
                            idObj = JSON.parse(uniqueId);
                            idObj.outputFileName = fileName;
                            return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(mp + "/api/gallery/link-upload", 'POST', idObj))];
                        case 1:
                            result = _a.sent();
                            for (i = 0; i < me.Rounds().length; i++) {
                                if (me.Rounds()[i].RoundNumber() === idObj.roundNumber) {
                                    for (j = 0; j < me.Rounds()[i].Artists().length; j++) {
                                        artist = me.Rounds()[i].Artists()[j];
                                        if (artist.id === idObj.contestantId) {
                                            artist.AddMedia(result.mediaInEvent);
                                            break;
                                        }
                                    }
                                    break;
                                }
                            }
                            return [2 /*return*/];
                    }
                });
            });
        };
        VotingScreenViewModel.prototype._updateProgress = function (identifier) {
            var me = this;
            var reqArr = me.RequestArr();
            reqArr.splice(me.uploadIndexMap[identifier], 1);
            me.RequestArr(reqArr);
            Object.keys(me.uploadIndexMap).forEach(function (key) {
                me.uploadIndexMap[key] = me.RequestArr().indexOf(me.uploadIndexMap[key]);
            });
        };
        return VotingScreenViewModel;
    }());

    var vm = new VotingScreenViewModel();
    ko$1.components.register('progress-bar', {
        viewModel: function (params) {
            var that = this;
            // progress is a numeric value between 0 and 100
            that.progress = params.progress;
            that.totalUploads = params.totalUploads;
            that.progressPercentual = ko$1.computed(function () {
                return '' + Math.round(ko$1.utils.unwrapObservable(that.progress)) + '%';
            });
        },
        template: '<div class="progress" style="height: 22px; margin-bottom: 2px;">' +
            '<div class="progress-bar progress-bar-striped progress-bar-success active" data-bind="text: `Uploading - ${progressPercentual()}`, style:{width:progressPercentual()}, attr: {\'aria-valuenow\':progress}" style="height: 22px; background-color: #10CB00; min-width: 16em; line-height: 20px;" role="progressbar" aria-valuemin="0" aria-valuemax="100">' +
            '</div>' +
            '</div>'
    });
    ko$1.bindingHandlers.beforeUnloadText = {
        init: function (element, valueAccessor, allBindingsAccessor, viewModel) {
            if (window.onbeforeunload == null && !(navigator.userAgent.match(/iPad/i) || navigator.userAgent.match(/iPhone/i))) {
                // in ios this event is not supported
                window.onbeforeunload = function () {
                    var value = valueAccessor();
                    var promptText = ko$1.utils.unwrapObservable(value);
                    if (typeof promptText == 'undefined' || promptText == null) ;
                    else {
                        if (promptText != null && typeof promptText != 'string') {
                            var err = 'Error: beforeUnloadText binding must be ' +
                                'against a string or string observable.  ' +
                                'Binding was done against a ' + typeof promptText;
                            console.error(err);
                            return err;
                        }
                        return promptText;
                    }
                };
            }
            else {
                var err = 'onbeforeupload has already been set';
                console.error(err);
            }
        }
    };
    ko$1.bindingHandlers.modal = {
        init: function (element, valueAccessor) {
            // @ts-ignore
            $(element).modal({
                show: false
            });
            var value = valueAccessor();
            if (ko$1.isObservable(value)) {
                $(element).on('hidden.bs.modal', function () {
                    value(false);
                });
            }
        },
        update: function (element, valueAccessor) {
            var value = valueAccessor();
            if (ko$1.utils.unwrapObservable(value)) {
                // @ts-ignore
                $(element).modal('show');
            }
            else {
                // @ts-ignore
                $(element).modal('hide');
            }
        }
    };
    var koRoot = document.getElementById('koroot');
    ko$1.applyBindings(vm, koRoot);

}(ko));
