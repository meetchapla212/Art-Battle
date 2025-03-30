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

    var Image = /** @class */ (function () {
        function Image(artistImage) {
            this.Thumbnail = ko.observable();
            this.Compressed = ko.observable();
            this.Thumbnail(artistImage.Thumbnail);
            this.Compressed(artistImage.Compressed);
        }
        return Image;
    }());

    var Round = /** @class */ (function () {
        function Round(roundArtist, Vm, Event) {
            this.RoundNumber = ko$1.observable();
            this.Images = ko$1.observableArray();
            this.RoundNumber(roundArtist.RoundNumber);
            this.Vm = Vm;
            this.Event = Event;
            var Artists = roundArtist.Artists;
            for (var i = 0; i < Artists.length; i++) {
                this._assignArtistImages(Artists[i]);
            }
        }
        Round.prototype._assignArtistImages = function (artist) {
            var latestImg = artist.Images[artist.Images.length - 1];
            if (latestImg) {
                var cityText = this.Event.City() ? " in " + this.Event.City() : '';
                console.log('this.Event', this.Event);
                this.Vm.Images().push({
                    url: new Image(latestImg).Compressed().url,
                    imageContext: "Round " + this.RoundNumber() + " painting from " + (this.Event.EID() || this.Event.Name()) + (cityText || '')
                });
            }
            /*for (let k = 0; k < artist.Images.length; k++) {
                const image = artist.Images[k];
                this.Vm.Images().push(new Image(image));
            }*/
        };
        return Round;
    }());

    var Event = /** @class */ (function () {
        function Event(artistInEvent, Vm) {
            this.Name = ko$1.observable();
            this.Country = ko$1.observable();
            this.Rounds = ko$1.observableArray();
            this.WinnerText = ko$1.observable();
            this.NameWithoutArtId = ko$1.observable();
            this.EID = ko$1.observable();
            this.UserVoteLink = ko$1.observable();
            this.EventDate = ko$1.observable('');
            this.EventDateEID = ko$1.observable();
            this.City = ko$1.observable();
            this.LinkCss = ko$1.observable('');
            this.Country(artistInEvent.Country);
            var hyphenIdx = artistInEvent.Name.indexOf('-');
            var calcEid;
            if (hyphenIdx !== -1) {
                calcEid = artistInEvent.Name.slice(0, hyphenIdx).trim();
                this.City(artistInEvent.Name.slice(hyphenIdx + 1, artistInEvent.Name.length).trim());
            }
            else {
                calcEid = artistInEvent.EID;
            }
            this.EID(calcEid);
            this.Name(artistInEvent.Name);
            if (artistInEvent.UserVoteHash) {
                this.UserVoteLink("/v/" + artistInEvent.UserVoteHash);
                this.LinkCss('link');
            }
            this.WinnerText('');
            if (artistInEvent.EventStartDateTime) {
                this.EventDate(new Date(artistInEvent.EventStartDateTime).toLocaleDateString());
            }
            this.NameWithoutArtId(artistInEvent.Name.replace(this.EID() + " -", '').trim());
            this.EventDateEID(this.EventDate() + " " + this.EID());
            for (var i = 0; i < artistInEvent.roundWiseImages.length; i++) {
                var roundObj = new Round(artistInEvent.roundWiseImages[i], Vm, this);
                this.Rounds.push(roundObj);
            }
        }
        // used in view
        Event.prototype.OpenEventLink = function (vm) {
            if (this.UserVoteLink()) {
                // @ts-ignore
                window.location.href = mp + this.UserVoteLink();
            }
        };
        return Event;
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

    var ArtistPublicProfileViewModel = /** @class */ (function () {
        function ArtistPublicProfileViewModel(auth) {
            this.Auth = ko$1.observable();
            this.IsFollowing = ko$1.observable();
            this.ParsedName = ko$1.observable();
            this.CityText = ko$1.observable();
            this.Events = ko$1.observableArray();
            this.Message = ko$1.observable();
            this.MessageCss = ko$1.observable();
            this.LoadingTracker = new BusyTracker();
            this.ShowFollowingButton = ko$1.observable();
            this.Bio = ko$1.observable();
            this.Instagram = ko$1.observable();
            this.Website = ko$1.observable();
            this.AdminBio = ko$1.observable();
            this.AdminNotes = ko$1.observable();
            this.FollowersCount = ko$1.observable();
            this.FollowingText = ko$1.observable();
            this.Images = ko$1.observableArray([]);
            this.ImageContexts = ko$1.observableArray([]);
            this.FollowingCss = ko$1.computed(this.getFollowingCss.bind(this));
            this.SelectedImageIndex = ko$1.observable();
            this.SelectedImage = ko$1.observable();
            this.SelectedImageContext = ko$1.observable();
            // @ts-ignore this comes from html view
            this.ArtistId = artistId;
            this.Auth(auth);
            // @ts-ignore this comes from html view
            var profile = artistProfile;
            this.IsFollowing(profile.IsFollowing);
            this.IsFollowing.notifySubscribers();
            this.ParsedName(profile.ParsedName);
            this.CityText(profile.CityText);
            this.FollowersCount(profile.Score);
            if (this.FollowersCount() > 0) {
                this.FollowingText(profile.Score + " following");
            }
            for (var i = 0; i < profile.ArtistInEvents.length; i++) {
                var eventObj = new Event(profile.ArtistInEvents[i], this);
                this.Events().push(eventObj);
            }
            // this.SelectedImage(this.Images()[0]);
            this.SelectedImageContext(this.ImageContexts()[0] || '');
            var token = this.Auth().get();
            // @ts-ignore
            this.ShowFollowingButton(token && token.length > 0 || phoneHash && phoneHash.length > 0);
            this.Bio(profile.Bio);
            this.Instagram(profile.Instagram);
            this.Images(this.Images().reverse());
            if (Array.isArray(profile.WooProducts)) {
                for (var i = 0; i < profile.WooProducts.length; i++) {
                    if (profile.WooProducts[i].images[0] && profile.WooProducts[i].images[0].src) {
                        var isBuy = profile.WooProducts[i].purchasable && profile.WooProducts[i].price;
                        this.Images.push({
                            url: profile.WooProducts[i].images[0].src,
                            imageContext: profile.WooProducts[i].name,
                            clickUrl: profile.WooProducts[i].permalink,
                            price: isBuy ? " - for sale on artbattle.com - " + profile.WooProducts[i].price : ''
                        });
                    }
                }
            }
            for (var i = 0; i < profile.Images.length; i++) {
                if (profile.Images[i] && profile.Images[i].length > 0) {
                    this.Images.push({
                        url: profile.Images[i],
                        imageContext: "Studio work sample from " + (this.ParsedName().firstName || '') + " " + (this.ParsedName().lastName || '')
                    });
                }
            }
            this.Website(profile.Website);
            this.AdminBio(profile.AdminBio);
            this.AdminNotes(profile.AdminNotes);
        }
        ArtistPublicProfileViewModel.prototype.ToggleFollow = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (this.IsFollowing()) {
                                this.IsFollowing(false);
                            }
                            else {
                                this.IsFollowing(true);
                            }
                            this.IsFollowing.notifySubscribers();
                            return [4 /*yield*/, this.updateFollowStatus()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        ArtistPublicProfileViewModel.prototype.getFollowingCss = function () {
            return this.IsFollowing() && 'following' || 'not-following';
        };
        ArtistPublicProfileViewModel.prototype.updateFollowStatus = function () {
            return __awaiter(this, void 0, void 0, function () {
                var e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(
                                // @ts-ignore phoneHash coming from view
                                mp + "/api/artist/follow/" + this.ArtistId + "/" + phoneHash, 'POST', {
                                    IsFollowing: this.IsFollowing()
                                }, null, this.Auth().get()))];
                        case 1:
                            _a.sent();
                            return [3 /*break*/, 3];
                        case 2:
                            e_1 = _a.sent();
                            console.error(e_1);
                            this.Message(e_1 && e_1.Message || e_1.message || 'An error occurred');
                            this.MessageCss('alert-danger');
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        ArtistPublicProfileViewModel.prototype.OpenProductUrl = function (Image) {
            if (Image.clickUrl) {
                window.location.href = Image.clickUrl;
                return;
            }
            return false;
        };
        return ArtistPublicProfileViewModel;
    }());

    var JWTAuth = /** @class */ (function () {
        function JWTAuth() {
        }
        /**
         * Save Token in Local Storage
         */
        JWTAuth.prototype.set = function (token) {
            this._token = token;
        };
        JWTAuth.prototype.get = function () {
            return this._token;
        };
        return JWTAuth;
    }());

    /// <reference path='../Common/ArrayExtensions.ts'/>
    var koRoot = document.getElementById('koroot');
    var auth = new JWTAuth();
    // @ts-ignore token comes from global JS
    auth.set(token);
    var vm = new ArtistPublicProfileViewModel(auth);
    ko$1.applyBindings(vm, koRoot);

}(ko));
