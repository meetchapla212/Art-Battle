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

    var Image = /** @class */ (function () {
        function Image(dto) {
            this.Original = ko.observable();
            this.Thumbnail = ko.observable();
            this.Compressed = ko.observable();
            this.Original(dto.Original);
            this.Thumbnail(dto.Thumbnail);
            this.Compressed(dto.Compressed);
        }
        return Image;
    }());

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

    var Artist = /** @class */ (function () {
        function Artist(dto, Event, ArtId, Vm) {
            this.Name = ko$1.observableArray([]);
            this.Images = ko$1.observableArray([]);
            this.SelectedImage = ko$1.observable();
            this.SelectedImageIndex = ko$1.observable();
            this.VoteText = ko$1.observable('Vote');
            this.VoteUpdater = new BusyTracker();
            this.LastStateIndex = ko$1.observable(0);
            this.Status = ko$1.observable();
            this.States = [
                'BID',
                'Confirm?',
                '&#9673;',
            ];
            this.CssStates = [
                '',
                'confirm',
                'success'
            ];
            this.VoteCss = ko$1.observable();
            this.ArtId = ko$1.observable();
            this.ErrorMessage = ko$1.observable();
            this.Auth = ko$1.observable();
            this.TopBids = ko$1.observableArray([]);
            this.AuctionStatus = ko$1.observable();
            this.AuctionStatusCss = ko$1.observable();
            this.AuctionStatusText = ko$1.observable();
            this.Active = ko$1.observable();
            this.UserName = ko$1.observable();
            this.Bid = ko$1.observable(0);
            this.SumBid = ko$1.observable(0);
            this.AuctionCss = ko$1.observable();
            this.LastBidPrice = ko$1.observable(0);
            this.CurrencySymbol = ko$1.observable('$');
            this.DecrementCss = ko$1.observable('');
            this.IsAdmin = ko$1.observable(false);
            this.WidthAndHeight = ko$1.observable();
            this.Description = ko$1.observable();
            this.AuctionMessage = ko$1.observable('Bid');
            this.MinBidIncrement = ko$1.observable(5);
            this.AuctionNotice = ko$1.observable('');
            this.AuctionStartBid = ko$1.observable();
            this.Link = ko$1.observable();
            this.PriceText = ko$1.observable();
            this.Vm = Vm;
            this.Auth(Event.Auth());
            this.EaselNumber = dto.EaselNumber;
            this.OriginalName = dto.Detail.Name;
            this.Name(dto.Detail.Name.split(' '));
            this.id = dto.Detail._id;
            // @ts-ignore comes from html
            this.Link("/ar/" + this.id + "/" + phoneHash);
            if (this.Images().length) {
                this.Images().splice(0, this.Images().length);
            }
            var _loop_1 = function (i) {
                var index = this_1.Images().findIndex(function (x) { return x.Thumbnail().url == dto.Images[i].Thumbnail.url; });
                if (index == -1) {
                    this_1.Images().push(new Image(dto.Images[i]));
                }
            };
            var this_1 = this;
            for (var i = 0; i < dto.Images.length; i++) {
                _loop_1(i);
            }
            if (this.Images().length > 0) {
                var Index = this.Images().length - 1;
                this.SelectedImage(this.Images()[Index]);
                this.SelectedImageIndex(Index);
            }
            this.Event = Event;
            this.ArtId(ArtId);
            this.LastBidPrice(dto.LastBidPrice);
            this.AuctionNotice(dto.AuctionNotice || Event.AuctionNotice());
            this.Country = dto.Country || Event.Country;
            this.Currency = dto.Currency || Event.Currency;
            this.MinBidIncrement(Event.MinBidIncrement() || dto.MinBidIncrement);
            this.AuctionStartBid(Event.AuctionStartBid() || dto.AuctionStartBid);
            this.Bid(Artist._round(this.LastBidPrice() + (this.LastBidPrice() * (this.MinBidIncrement() / 100))) || Event.AuctionStartBid());
            this.CurrencySymbol((Event.Currency && Event.Currency.currency_symbol) || '$');
            // comes from global var
            // @ts-ignore
            // @ts-ignore
            if (artId && this.ArtId().trim() == artId.trim()) {
                this.OpenAuction().catch(function (e) {
                    if (e) {
                        console.error(e);
                    }
                    else {
                        console.error('error in getAuctionDetail e');
                    }
                });
            }
            if (this.LastBidPrice() && dto.BidCount > 0 && dto.EnableAuction === 1) {
                this.PriceText(this.CurrencySymbol() + " " + this.LastBidPrice());
            }
        }
        // used in click event in view
        Artist.prototype.CycleImage = function () {
            var index = this.SelectedImageIndex() - 1;
            if (index >= 0) {
                this.SelectedImageIndex(index);
            }
            else {
                index = this.Images().length - 1;
                this.SelectedImageIndex(index);
            }
            this.SelectedImage(this.Images()[index]);
        };
        Artist._round = function (x) {
            return Math.ceil(x / 5) * 5;
        };
        Artist.prototype.getAuctionDetail = function (scroll) {
            if (scroll === void 0) { scroll = true; }
            return __awaiter(this, void 0, void 0, function () {
                var result, _a, _b, _c, _d, _loop_2, this_2, i;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            _b = (_a = this.VoteUpdater).AddOperation;
                            _c = Request;
                            _d = [mp + "/api/auction/" + this.ArtId(), 'GET', null, null];
                            return [4 /*yield*/, this.Auth().get()];
                        case 1: return [4 /*yield*/, _b.apply(_a, [_c.apply(void 0, _d.concat([_e.sent()]))])];
                        case 2:
                            result = _e.sent();
                            if (result.Success) {
                                if (this.Images().length) {
                                    this.Images().splice(0, this.Images().length);
                                }
                                _loop_2 = function (i) {
                                    var index = this_2.Images().findIndex(function (x) { return (x.Thumbnail().url).toString() == (result.Data.Arts[i].Thumbnail.url).toString(); });
                                    if (index == -1) {
                                        this_2.Images().push(new Image(result.Data.Arts[i]));
                                    }
                                };
                                this_2 = this;
                                for (i = 0; i < result.Data.Arts.length; i++) {
                                    _loop_2(i);
                                }
                                if (result.Data.SelectArtIndex >= 0) {
                                    this.SelectedImage(this.Images()[result.Data.SelectArtIndex]);
                                    this.SelectedImageIndex(result.Data.SelectArtIndex);
                                }
                                this.TopBids(result.Data.TopNBids);
                                this.AuctionStatus(result.Data.Status);
                                if (this.AuctionStatus() === 0 && this.Images().length === 0) {
                                    this.AuctionStatusCss('auction-pending');
                                    this.AuctionStatusText('Auction Yet to start');
                                }
                                else if (this.AuctionStatus() === 1) {
                                    this.AuctionStatusCss('auction-open');
                                    this.AuctionStatusText('Auction Open');
                                }
                                else {
                                    this.AuctionStatusCss('auction-closed');
                                    this.AuctionStatusText('Auction Closed');
                                }
                                this.UserName(result.Data.UserName);
                                this.Vm.setActiveArtist(this);
                                if (!(this.AuctionStatus() === 0 || this.AuctionStatus() === 2)) {
                                    this.RefreshIntervalHandle = setInterval(this.getAuctionDetail.bind(this, false), 3000);
                                }
                                if (scroll) {
                                    $('html,body').animate({ scrollTop: $('.bid-info').offset().top }, 500);
                                }
                                this.Name(result.Data.ArtistName && result.Data.ArtistName.split(' '));
                                this.OriginalName = result.Data.ArtistName;
                                this._SumBidAmount();
                                this.Description(result.Data.Description);
                                this.WidthAndHeight(result.Data.WidthAndHeight);
                                this.IsAdmin(result.Data.isAdmin);
                                this.CurrencySymbol(result.Data.CurrencySymbol);
                            }
                            else {
                                this.ErrorMessage('An Error occurred');
                            }
                            return [2 /*return*/];
                    }
                });
            });
        };
        // used in pug
        Artist.prototype.handleBidClick = function (Vm, e) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            e.stopPropagation();
                            this.LastStateIndex(this.LastStateIndex() + 1);
                            this.Status(this.States[this.LastStateIndex()]);
                            this.AuctionCss(this.CssStates[this.LastStateIndex()]);
                            this.AuctionMessage(this.Status());
                            if (!(this.LastStateIndex() + 1 === this.States.length)) return [3 /*break*/, 2];
                            // End of the cycle
                            // perform bidding
                            return [4 /*yield*/, this.BidForArt()];
                        case 1:
                            // End of the cycle
                            // perform bidding
                            _a.sent();
                            this.LastStateIndex(-1);
                            _a.label = 2;
                        case 2: return [2 /*return*/];
                    }
                });
            });
        };
        Artist.prototype._SumBidAmount = function () {
            this.SumBid(parseInt('' + this.Bid()) || 0);
            for (var i = 0; i < this.TopBids().length; i++) {
                this.SumBid(this.SumBid() + this.TopBids()[i].Amount);
            }
        };
        Artist.prototype.OpenAuction = function () {
            return __awaiter(this, void 0, void 0, function () {
                var slickCount, removeSliderCount, i;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.Vm.ActiveArtistDescription(undefined);
                            this.Vm.ActiveArtistWidthAndHeight(undefined);
                            return [4 /*yield*/, this.getAuctionDetail()];
                        case 1:
                            _a.sent();
                            this.Vm.ActiveArtistDescription(this.Description());
                            this.Vm.ActiveArtistWidthAndHeight(this.WidthAndHeight());
                            if ($('.slider-nav').hasClass('slick-initialized') || $('.slider-nav').hasClass('slick-slider')) {
                                $('.slider-nav').slick('unslick');
                                $('.slider-nav').slick('destroy');
                                $('.slider-nav').slick('refresh');
                                slickCount = $(".slider-nav").slick("getSlick").slideCount;
                                removeSliderCount = slickCount - this.Images().length;
                                for (i = 0; i < removeSliderCount; i++) {
                                    $('.slider-nav').slick('slickRemove', this.Images().length);
                                }
                            }
                            $('.slider-nav').slick({
                                slidesToShow: 4,
                                slidesToScroll: 1,
                                dots: false,
                                focusOnSelect: true
                            });
                            return [2 /*return*/];
                    }
                });
            });
        };
        Artist.prototype.ResetButtonState = function (index) {
            var me = this;
            me.LastStateIndex(index);
            me.Status(me.States[me.LastStateIndex()]);
            me.AuctionMessage(me.Status());
            me.AuctionCss(me.CssStates[me.LastStateIndex()]);
        };
        Artist.prototype.BidForArt = function () {
            return __awaiter(this, void 0, void 0, function () {
                var Event, me, token, result, _a, _b, _c, _d, e_1;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            Event = this.Event;
                            me = this;
                            _e.label = 1;
                        case 1:
                            _e.trys.push([1, 10, , 11]);
                            return [4 /*yield*/, Event.Auth().get()];
                        case 2:
                            token = _e.sent();
                            if (!(token && token.length > 0)) return [3 /*break*/, 8];
                            _b = (_a = this.VoteUpdater).AddOperation;
                            _c = Request;
                            _d = [mp + "/api/auction/bid/" + this.ArtId() + "/" + this.Bid(), 'PUT', null, null];
                            return [4 /*yield*/, this.Auth().get()];
                        case 3: return [4 /*yield*/, _b.apply(_a, [_c.apply(void 0, _d.concat([_e.sent()]))])];
                        case 4:
                            result = _e.sent();
                            if (!result.Success) return [3 /*break*/, 6];
                            return [4 /*yield*/, this.getAuctionDetail()];
                        case 5:
                            _e.sent();
                            return [3 /*break*/, 7];
                        case 6:
                            if (result.code === 'VERIFY') {
                                // this.ErrorMessage('Bid Failure');
                                // this.ResetButtonState(me.LastStateIndex() - 1);
                                this.Vm.Name(result.Name || '');
                                this.Vm.Email(result.Email || '');
                                this.Vm.NickName(result.NickName || '');
                                this.Vm.ShowEmailAndNamePopup(true);
                                this.Vm.RetryBid(true);
                            }
                            else {
                                this.ErrorMessage('Bid Failure');
                                this.ResetButtonState(me.LastStateIndex() - 1);
                            }
                            _e.label = 7;
                        case 7: return [3 /*break*/, 9];
                        case 8:
                            this.ResetButtonState(me.LastStateIndex() - 1);
                            _e.label = 9;
                        case 9: return [3 /*break*/, 11];
                        case 10:
                            e_1 = _e.sent();
                            if (e_1.message === 'INVALID_TOKEN') ;
                            e_1.Message && alert(e_1.Message);
                            console.error(e_1);
                            this.ResetButtonState(me.LastStateIndex() - 1);
                            return [3 /*break*/, 11];
                        case 11: return [2 /*return*/];
                    }
                });
            });
        };
        Artist.prototype.DecrementBid = function () {
            var calculatedBid = this.Bid() - (this.Bid() * (this.MinBidIncrement() / 100));
            if (calculatedBid > this.LastBidPrice()) {
                this.Bid(Artist._round(calculatedBid));
            }
            else {
                this.DecrementCss('text-muted');
            }
        };
        Artist.prototype.IncrementBid = function () {
            this.Bid(Artist._round(this.Bid() + (this.Bid() * (this.MinBidIncrement() / 100))));
            this.DecrementCss('');
        };
        return Artist;
    }());

    var Round = /** @class */ (function () {
        function Round(Event, Vm, topArtistIndex, dto, topRoundDto) {
            this.Artists = ko$1.observableArray([]);
            this.Auth = ko$1.observable();
            this.Auth(Event.Auth());
            var EID = Event.EID;
            if (dto) {
                this.RoundNumber = dto.RoundNumber;
                if (topArtistIndex !== -1) {
                    if (dto.Contestants[topArtistIndex].Enabled && (dto.Contestants[topArtistIndex].EnableAuction || (dto.Contestants[topArtistIndex].Images && dto.Contestants[topArtistIndex].Images.length > 0))
                        && dto.Contestants[topArtistIndex].Images.length > 0 && dto.Contestants[topArtistIndex].EaselNumber > 0) {
                        this.Artists().push(new Artist(dto.Contestants[topArtistIndex], Event, dto.Contestants[topArtistIndex].ArtId || EID + "-" + this.RoundNumber + "-" + dto.Contestants[topArtistIndex].EaselNumber, Vm));
                    }
                }
                for (var i = 0; i < dto.Contestants.length; i++) {
                    if (topArtistIndex !== i && (dto.Contestants[i].Enabled && (dto.Contestants[i].EnableAuction || (dto.Contestants[i].Images && dto.Contestants[i].Images.length > 0)))
                        && dto.Contestants[i].Images.length > 0 && dto.Contestants[i].EaselNumber > 0) {
                        this.Artists().push(new Artist(dto.Contestants[i], Event, dto.Contestants[i].ArtId || EID + "-" + this.RoundNumber + "-" + dto.Contestants[i].EaselNumber, Vm));
                    }
                }
            }
            else {
                this.RoundNumber = topRoundDto.RoundNumber;
                if (topArtistIndex !== -1) {
                    if (topRoundDto.Contestants[topArtistIndex].Enabled && (topRoundDto.Contestants[topArtistIndex].EnableAuction || (topRoundDto.Contestants[topArtistIndex].Images && topRoundDto.Contestants[topArtistIndex].Images.length > 0))
                        && topRoundDto.Contestants[topArtistIndex].Images.length > 0 && topRoundDto.Contestants[topArtistIndex].EaselNumber > 0) {
                        this.Artists().push(new Artist(topRoundDto.Contestants[topArtistIndex], Event, topRoundDto.Contestants[topArtistIndex].ArtId || EID + "-" + this.RoundNumber + "-" + topRoundDto.Contestants[topArtistIndex].EaselNumber, Vm));
                    }
                }
                for (var i = 0; i < topRoundDto.Contestants.length; i++) {
                    if (topArtistIndex !== i && (topRoundDto.Contestants[i].Enabled && (topRoundDto.Contestants[i].EnableAuction || (topRoundDto.Contestants[i].Images && topRoundDto.Contestants[i].Images.length > 0)))
                        && topRoundDto.Contestants[i].Images.length > 0 && topRoundDto.Contestants[i].EaselNumber > 0) {
                        this.Artists().push(new Artist(topRoundDto.Contestants[i], Event, topRoundDto.Contestants[i].ArtId || EID + "-" + this.RoundNumber + "-" + topRoundDto.Contestants[i].EaselNumber, Vm));
                    }
                }
            }
        }
        return Round;
    }());

    var EventView = /** @class */ (function () {
        function EventView(auth, Vm, topRoundIndex, topArtistIndex, dto, topEventDto) {
            if (topRoundIndex === void 0) { topRoundIndex = -1; }
            if (topArtistIndex === void 0) { topArtistIndex = -1; }
            this.Auth = ko$1.observable();
            this.Rounds = ko$1.observableArray([]);
            this.AuctionNotice = ko$1.observable();
            this.AuctionStartBid = ko$1.observable();
            this.MinBidIncrement = ko$1.observable();
            this.Top = ko$1.observable();
            this.VoteUrl = ko$1.observable();
            this.Top(!!topEventDto);
            this.Country = undefined;
            this.Name = '';
            if (dto) {
                this.Country = dto.Country;
                this.Currency = dto.Currency;
                this.AuctionNotice(dto.AuctionNotice);
                this.AuctionStartBid(dto.AuctionStartBid);
                this.MinBidIncrement(dto.MinBidIncrement);
                this.Name = dto.Name;
                this.EID = dto.EID.toString();
                this.Auth(auth);
                this._id = dto._id;
                this.VoteUrl(dto.VoteUrl);
                if (topRoundIndex !== -1) {
                    this.Rounds()[topRoundIndex] = new Round(this, Vm, topArtistIndex, dto.Rounds[topRoundIndex]);
                }
                for (var i = 0; i < dto.Rounds.length; i++) {
                    if (topRoundIndex !== i) {
                        this.Rounds()[i] = new Round(this, Vm, topArtistIndex, dto.Rounds[i]);
                    }
                }
            }
            else if (topEventDto) {
                this.Country = undefined;
                this.Name = topEventDto.Name;
                this.EID = topEventDto.EID.toString();
                this.Auth(auth);
                this.Top(!!topEventDto);
                this._id = topEventDto._id;
                if (topRoundIndex !== -1) {
                    this.Rounds()[topRoundIndex] = new Round(this, Vm, topArtistIndex, null, topEventDto.Rounds[topRoundIndex]);
                }
                for (var i = 0; i < topEventDto.Rounds.length; i++) {
                    if (topRoundIndex !== i) {
                        this.Rounds()[i] = new Round(this, Vm, topArtistIndex, null, topEventDto.Rounds[i]);
                    }
                }
            }
        }
        EventView.prototype.OpenVotingLink = function () {
            if (this.VoteUrl() && this.VoteUrl().length > 0) {
                // @ts-ignore
                window.location.href = mp + this.VoteUrl();
            }
        };
        return EventView;
    }());

    var AuctionViewModel = /** @class */ (function () {
        function AuctionViewModel(auth, eventId, loadAtInit) {
            if (loadAtInit === void 0) { loadAtInit = true; }
            this.Message = ko$1.observable('');
            this.disableSubmit = ko$1.observable(false);
            this.Auth = ko$1.observable();
            this.EventListUpdater = new BusyTracker();
            this.EventListView = ko$1.observableArray();
            this.ErrorMessage = ko$1.observable();
            this.ActiveArtist = ko$1.observable();
            this.UserNumber = ko$1.observable();
            this.UserOTP = ko$1.observable();
            this.VerifyUser = ko$1.observable(false);
            this.RegistrationId = ko$1.observable();
            this.RegisterErrorMessage = ko$1.observable();
            this.ActiveArtistWidthAndHeight = ko$1.observable();
            this.ActiveArtistDescription = ko$1.observable();
            this.LotSaveMessage = ko$1.observable();
            this.LotSaveCss = ko$1.observable();
            this.ShowEmailAndNamePopup = ko$1.observable(false);
            this.Name = ko$1.observable();
            this.Email = ko$1.observable();
            this.NickName = ko$1.observable();
            this.ArtBattleNews = ko$1.observable(false);
            this.NotificationEmails = ko$1.observable(false);
            this.LoyaltyOffers = ko$1.observable(false);
            this.MoreDetailMessage = ko$1.observable();
            this.MoreDetailCss = ko$1.observable();
            // used in view
            this.ShowAdminControls = ko$1.observable();
            this.RetryBid = ko$1.observable(false);
            this.Auth(auth);
            this.EventId = eventId;
            if (loadAtInit) {
                this.populateEventList().catch(function (e) {
                    if (e) {
                        console.error(e);
                    }
                    else {
                        console.error('error in e');
                    }
                });
            }
        }
        AuctionViewModel.prototype.messageClick = function (message) {
            this.Message(message);
        };
        AuctionViewModel.prototype.submitForm = function (form) {
            $(form).find('button').addClass('disabled');
            if (!this.disableSubmit()) {
                // submit is allowed
                this.disableSubmit(true);
                return true;
            }
            else {
                return false;
            }
        };
        AuctionViewModel.prototype.populateEventList = function () {
            return __awaiter(this, void 0, void 0, function () {
                var result, _a, _b, _c, _d, topEventIndex, topRoundIndex, topArtistIndex, topEvents, i;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            _b = (_a = this.EventListUpdater).AddOperation;
                            _c = Request;
                            _d = [
                                // @ts-ignore artId phoneHash comes from js
                                mp + "/api/auction/events?artId=" + artId + "&phoneHash=" + phoneHash + "&eventId=" + (this.EventId || ''), 'GET', null, null];
                            return [4 /*yield*/, this.Auth().get()];
                        case 1: return [4 /*yield*/, _b.apply(_a, [_c.apply(void 0, _d.concat([_e.sent()]))])];
                        case 2:
                            result = _e.sent();
                            if (result.Success) {
                                topEventIndex = result.Data.topEventIndex;
                                topRoundIndex = result.Data.topRoundIndex;
                                topArtistIndex = result.Data.topArtistIndex;
                                topEvents = result.Data.topEventsArr;
                                if (topEventIndex !== -1) {
                                    this.EventListView.push(new EventView(this.Auth(), this, topRoundIndex, topArtistIndex, result.Data.eventsArr[topEventIndex]));
                                }
                                for (i = 0; i < result.Data.eventsArr.length; i++) {
                                    if (topEventIndex !== i) {
                                        this.EventListView.push(new EventView(this.Auth(), this, -1, -1, result.Data.eventsArr[i]));
                                    }
                                }
                                if (topEvents[0]) {
                                    if (this.EventListView.length > 0) {
                                        this.EventListView.splice(1, 0, new EventView(this.Auth(), this, topRoundIndex, topArtistIndex, null, topEvents[0]));
                                    }
                                    else {
                                        this.EventListView.push(new EventView(this.Auth(), this, topRoundIndex, topArtistIndex, null, topEvents[0]));
                                    }
                                }
                            }
                            else {
                                this.ErrorMessage('An Error occurred');
                            }
                            return [2 /*return*/];
                    }
                });
            });
        };
        AuctionViewModel.prototype.setActiveArtist = function (Artist) {
            if (this.ActiveArtist() && this.ActiveArtist().RefreshIntervalHandle) {
                clearInterval(this.ActiveArtist().RefreshIntervalHandle);
            }
            this.ActiveArtist(Artist);
        };
        AuctionViewModel.prototype.RegisterUser = function () {
            return __awaiter(this, void 0, void 0, function () {
                var result, _a, _b, _c, _d, e_1;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            _e.trys.push([0, 3, , 4]);
                            this.RegisterErrorMessage('');
                            _b = (_a = this.EventListUpdater).AddOperation;
                            _c = Request;
                            _d = [mp + "/api/register", 'POST', {
                                    'eventId': this.ActiveArtist().Event._id,
                                    'PhoneNumber': this.UserNumber()
                                }, null];
                            return [4 /*yield*/, this.Auth().get()];
                        case 1: return [4 /*yield*/, _b.apply(_a, [_c.apply(void 0, _d.concat([_e.sent()]))])];
                        case 2:
                            result = _e.sent();
                            if (result.Success) {
                                this.VerifyUser(true);
                                this.RegistrationId(result.Data.RegistrationId);
                                alert('Please enter text verification code received in SMS');
                            }
                            else {
                                this.RegisterErrorMessage('An Error occurred');
                            }
                            return [3 /*break*/, 4];
                        case 3:
                            e_1 = _e.sent();
                            console.error(e_1);
                            this.RegisterErrorMessage(e_1.message || 'An error occurred');
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        AuctionViewModel.prototype.VerifyOTP = function () {
            return __awaiter(this, void 0, void 0, function () {
                var result, _a, _b, _c, _d, e_2;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            _e.trys.push([0, 3, , 4]);
                            this.RegisterErrorMessage('');
                            _b = (_a = this.EventListUpdater).AddOperation;
                            _c = Request;
                            _d = [mp + "/api/verifyOtp", 'POST', {
                                    registrationId: this.RegistrationId(),
                                    otp: this.UserOTP(),
                                    deviceToken: null,
                                    eventId: this.ActiveArtist().Event._id
                                }, null];
                            return [4 /*yield*/, this.Auth().get()];
                        case 1: return [4 /*yield*/, _b.apply(_a, [_c.apply(void 0, _d.concat([_e.sent()]))])];
                        case 2:
                            result = _e.sent();
                            if (result.Success) {
                                if (!result.Data.Name || result.Data.Name.length === 0) {
                                    this.ShowEmailAndNamePopup(true);
                                }
                                else {
                                    this.Name(result.Data.Name);
                                }
                                if (!result.Data.Email || result.Data.Email.length === 0) {
                                    this.ShowEmailAndNamePopup(true);
                                }
                                else {
                                    this.Email(result.Data.Email);
                                }
                                if (!result.Data.NickName || result.Data.NickName.length === 0) {
                                    this.ShowEmailAndNamePopup(true);
                                    this.NickName(result.Data.NickName);
                                }
                                this.VerifyUser(true);
                                this.Auth().set(result.Data.JWT);
                                this.VerifyUser(false);
                                this.ArtBattleNews(result.Data.ArtBattleNews);
                                this.NotificationEmails(result.Data.NotificationEmails);
                                this.LoyaltyOffers(result.Data.LoyaltyOffers);
                                if (!this.ShowEmailAndNamePopup()) {
                                    alert('You are now logged in');
                                }
                            }
                            else {
                                this.RegisterErrorMessage('An Error occurred');
                            }
                            return [3 /*break*/, 4];
                        case 3:
                            e_2 = _e.sent();
                            console.error(e_2);
                            this.RegisterErrorMessage(e_2.message || 'An error occurred');
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        AuctionViewModel.prototype.SaveLotConfig = function () {
            return __awaiter(this, void 0, void 0, function () {
                var result, _a, _b, _c, _d, e_3;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            _e.trys.push([0, 3, , 4]);
                            this.LotSaveMessage('');
                            this.LotSaveCss('');
                            _b = (_a = this.EventListUpdater).AddOperation;
                            _c = Request;
                            _d = [mp + "/api/auction/saveLotConfig/" + this.ActiveArtist().ArtId(), 'PUT', {
                                    Description: this.ActiveArtistDescription(),
                                    WidthAndHeight: this.ActiveArtistWidthAndHeight(),
                                }, null];
                            return [4 /*yield*/, this.Auth().get()];
                        case 1: return [4 /*yield*/, _b.apply(_a, [_c.apply(void 0, _d.concat([_e.sent()]))])];
                        case 2:
                            result = _e.sent();
                            if (result.Success) {
                                this.LotSaveMessage('Saved!');
                                this.LotSaveCss('alert-success');
                            }
                            else {
                                this.RegisterErrorMessage('An Error occurred');
                            }
                            return [3 /*break*/, 4];
                        case 3:
                            e_3 = _e.sent();
                            console.error(e_3);
                            this.LotSaveMessage(e_3.message || 'An error occurred');
                            this.LotSaveCss('alert-danger');
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        AuctionViewModel.prototype.submitMoreDetail = function () {
            return __awaiter(this, void 0, void 0, function () {
                var result, _a, _b, _c, _d, e_4;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            this.MoreDetailCss(undefined);
                            this.MoreDetailMessage(undefined);
                            if (!this.Email() || !this.Name() || !this.NickName()) {
                                this.MoreDetailCss('alert-danger');
                                this.MoreDetailMessage("Please fill all details");
                                return [2 /*return*/];
                            }
                            _e.label = 1;
                        case 1:
                            _e.trys.push([1, 8, , 9]);
                            _b = (_a = this.EventListUpdater).AddOperation;
                            _c = Request;
                            _d = [mp + "/api/set-nick-name", 'POST', {
                                    'nickName': this.NickName(),
                                    'Email': this.Email(),
                                    'Name': this.Name(),
                                    'ArtBattleNews': this.ArtBattleNews(),
                                    'NotificationEmails': this.NotificationEmails(),
                                    'LoyaltyOffers': this.LoyaltyOffers()
                                }, null];
                            return [4 /*yield*/, this.Auth().get()];
                        case 2: return [4 /*yield*/, _b.apply(_a, [_c.apply(void 0, _d.concat([_e.sent()]))])];
                        case 3:
                            result = _e.sent();
                            if (!result.Success) return [3 /*break*/, 6];
                            this.MoreDetailCss('alert-success');
                            this.MoreDetailMessage(result.Message);
                            this.ShowEmailAndNamePopup(false);
                            if (!(this.RetryBid() && this.ActiveArtist())) return [3 /*break*/, 5];
                            return [4 /*yield*/, this.ActiveArtist().BidForArt()];
                        case 4:
                            _e.sent();
                            _e.label = 5;
                        case 5: return [3 /*break*/, 7];
                        case 6:
                            this.MoreDetailCss('alert-danger');
                            this.MoreDetailMessage(result.Message || 'Internal server error');
                            _e.label = 7;
                        case 7: return [3 /*break*/, 9];
                        case 8:
                            e_4 = _e.sent();
                            console.error(e_4);
                            this.MoreDetailCss('alert-danger');
                            this.MoreDetailMessage(e_4.Message || e_4.message || 'Unexpected error');
                            return [3 /*break*/, 9];
                        case 9:
                            this.RetryBid(false);
                            return [2 /*return*/];
                    }
                });
            });
        };
        return AuctionViewModel;
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
    ko$1.bindingHandlers.modal = {
        init: function (element, valueAccessor) {
            // @ts-ignore
            $(element).modal({
                show: false,
                backdrop: 'static',
                keyboard: false
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
    var auth = new JWTAuth();
    // @ts-ignore token comes from global JS
    auth.set(token);
    var vm = new AuctionViewModel(auth);
    ko$1.applyBindings(vm, koRoot);

}(ko));
