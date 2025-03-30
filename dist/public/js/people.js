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

    var VideoUrl = /** @class */ (function () {
        function VideoUrl(Vm, Url, Index) {
            this.VideoUpdater = new BusyTracker();
            this.SaveMessage = ko$1.observable();
            this.SaveMessageCss = ko$1.observable();
            this.Url = ko$1.observable();
            this.Index = -1;
            this.Index = Index;
            this.Vm = Vm;
            this.Url(Url);
        }
        VideoUrl.prototype.Save = function () {
            return __awaiter(this, void 0, void 0, function () {
                var method, e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            method = 'PUT';
                            if (this.Index === -1) {
                                method = 'POST';
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, this.VideoUpdater.AddOperation(Request(
                                // @ts-ignore
                                mp + "/api/artist/add-video/" + this.Vm.Registration.Artist._id, method, this.ToDTO()))];
                        case 2:
                            _a.sent();
                            this.SaveMessage("Video Added");
                            this.SaveMessageCss('alert-success');
                            this.Vm.VideoUrls().push(this);
                            this.Vm.VideoUrls.notifySubscribers();
                            this.Vm.OpenPopup(false);
                            return [3 /*break*/, 4];
                        case 3:
                            e_1 = _a.sent();
                            console.error('error', e_1);
                            this.SaveMessage(e_1 && e_1.Message || e_1.message || 'An error occurred');
                            this.SaveMessageCss('alert-danger');
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        VideoUrl.prototype.ToDTO = function () {
            return {
                Index: this.Index,
                URL: this.Url()
            };
        };
        return VideoUrl;
    }());

    var PeopleViewModel = /** @class */ (function () {
        function PeopleViewModel(auth) {
            var _this = this;
            this.busy = ko$1.observable(false);
            this.PeopleStatusUpdater = new BusyTracker();
            // @ts-ignore
            this.Registration = registration;
            this.ErrorMessage = ko$1.observable();
            this.Loading = ko$1.observable(true);
            this.Auth = ko$1.observable();
            // @ts-ignore
            this.RegistrationId = registrationId;
            // @ts-ignore
            this.IsBlocked = ko$1.observable(isBlocked);
            // @ts-ignore
            this.MessageStatusCss = ko$1.computed(function () { return _this.IsBlocked() === 0 ? 'btn-default' : 'btn-danger'; });
            // @ts-ignore
            this.MessageStatusMessage = ko$1.computed(function () { return _this.IsBlocked() === 0 ? '&nbsp;' : 'Blocked'; });
            this.VideoUrls = ko$1.observableArray([]);
            this.OpenPopup = ko$1.observable();
            this.SelectedVideo = ko$1.observable();
            this.Auth(auth);
            if (this.Registration.Artist && Array.isArray(this.Registration.Artist.Videos)) {
                for (var i = 0; i < this.Registration.Artist.Videos.length; i++) {
                    this.VideoUrls().push(new VideoUrl(this, this.Registration.Artist.Videos[i], i));
                }
            }
        }
        // changing in view
        PeopleViewModel.prototype.handleMessageStatusChange = function () {
            return __awaiter(this, void 0, void 0, function () {
                var blocked, result, _a, _b, _c, _d, e_1;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            _e.trys.push([0, 3, , 4]);
                            blocked = this.IsBlocked();
                            if (blocked === 0) {
                                blocked = 1;
                            }
                            else {
                                blocked = 0;
                            }
                            _b = (_a = this.PeopleStatusUpdater).AddOperation;
                            _c = Request;
                            _d = [mp + "/api/people/message-status/" + this.RegistrationId + "/" + blocked, 'GET', null, null];
                            return [4 /*yield*/, this.Auth().get()];
                        case 1: return [4 /*yield*/, _b.apply(_a, [_c.apply(void 0, _d.concat([_e.sent()]))])];
                        case 2:
                            result = _e.sent();
                            if (result.Success) {
                                if (result.Data.length === 0) {
                                    this.IsBlocked(0);
                                }
                                else {
                                    this.IsBlocked(1);
                                }
                            }
                            return [3 /*break*/, 4];
                        case 3:
                            e_1 = _e.sent();
                            console.error(e_1);
                            this.MessageStatusCss('btn-danger');
                            this.MessageStatusMessage('<span>Error</span>');
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        PeopleViewModel.prototype.OpenVideoPopup = function () {
            this.OpenPopup(true);
            var videoUrl = new VideoUrl(this, '', -1);
            this.SelectedVideo(videoUrl);
        };
        return PeopleViewModel;
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

    var auth = new JWTAuth();
    // @ts-ignore token comes from global JS
    auth.set(token);
    var vm = new PeopleViewModel(auth);
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
    ko$1.applyBindings(vm, koRoot);

}(ko));
