(function (ko$1) {
'use strict';

class ContestantResults {
    constructor(dto, Rank) {
        this.Rank = Rank;
        this.VoteKey = null;
        this.Name = null;
        this.Votes = null;
        this.VoteKey = dto.VoteKey;
        this.Name = dto.Name;
        this.Votes = dto.Votes.length;
    }
}

class Round {
    constructor(dto) {
        this.RoundNumber = ko.observable();
        this.Contestants = ko.observableArray();
        this.RoundNumber(dto.RoundNumber);
        const contestants = dto.Contestants
            .sort((a, b) => b.Votes.length - a.Votes.length)
            .map((c, idx) => new ContestantResults(c, idx + 1));
        this.Contestants(contestants);
    }
}

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */













function __awaiter(thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

// export function MakeRequestGeneric<T>(url: string, method: 'GET' | 'PUT' | 'POST' | 'DELETE', data?: Object): JQueryPromise<T> {
//     const options: JQueryAjaxSettings = <JQueryAjaxSettings>{};
//     options.data = data && ko.toJSON(data);
//     options.dataType = 'json';
//     options.contentType = 'application/json';
//     options.type = method;
//     XMLHttpRequest; xhr = new XMLHttpRequest();
//     return request;
// }
function Request(url, method, data) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onreadystatechange = (event) => {
                if (xhr.readyState !== 4)
                    return;
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.response)); // OK
                }
                else {
                    reject(xhr.statusText); // Error
                }
            };
            xhr.open(method, url, true); // Async
            xhr.setRequestHeader('Content-Type', 'application/json');
            data ? xhr.send(JSON.stringify(data)) : xhr.send();
        });
    });
}

class BusyTracker {
    constructor() {
        this._tasks = ko.observableArray();
        this._operations = ko.observableArray();
        this.ConfigureDependentObservables();
    }
    ConfigureDependentObservables() {
        this.Busy = ko.computed({
            owner: this,
            read: () => {
                return this._tasks().length + this._operations().length > 0;
            }
        });
    }
    AddTask(task) {
        /// <param name="task" type="String">
        /// Identifies the task being performed that is keeping the tracker busy
        /// </param>
        if (!this._tasks().contains(task)) {
            this._tasks.push(task);
        }
    }
    AddOperations(operations) {
        /// <param name="operations" type="Array">
        /// </param>
        operations.forEach((operation) => {
            this.AddOperation(operation);
        });
    }
    AddOperation(operation) {
        return __awaiter(this, void 0, void 0, function* () {
            /// <param name="operation" type="JQueryPromise">
            /// </param>
            /// <returns type="JQueryPromise"></returns>
            const existingOperation = ko.utils.arrayFirst(this._operations(), (listOperation) => {
                return listOperation === operation;
            }, this);
            if (existingOperation == null) {
                this._operations.push(operation);
                operation.then(() => {
                    this._operations.remove(operation);
                });
            }
            return operation;
        });
    }
    TaskComplete(task) {
        /// <param name="task" type="String">
        /// </param>
        if (this._tasks().contains(task)) {
            this._tasks.remove(task);
        }
    }
    ClearTasks() {
        this._tasks.removeAll();
    }
    HasTask(taskName) {
        /// <param name="taskName" type="String">
        /// </param>
        /// <returns type="Boolean"></returns>
        return this._tasks().contains(taskName);
    }
}

class EventResultsViewModel {
    constructor() {
        this.Name = ko.observable();
        this.Rounds = ko.observableArray();
        this.LoadingTracker = new BusyTracker();
        // path is artbattle.com/event/{eventId}/round/{roundId}/results
        this._eventId = location.pathname.split('/')[1];
        this.LoadingTracker.AddOperation(Request(`api/event/${this._eventId}`, 'GET')
            .then((dto) => {
            this.Name(dto.Name);
            const rounds = dto.Rounds
                .sort((a, b) => a.RoundNumber - b.RoundNumber)
                .map(c => new Round(c));
        }));
    }
}

/// <reference path='../Common/ArrayExtensions.ts'/>
/// <reference path='../Common/StringExtensions.ts'/>
const vm = new EventResultsViewModel();
const koRoot = document.getElementById('koroot');
ko$1.applyBindings(vm, koRoot);

}(ko));
//# sourceMappingURL=voteResults.js.map
