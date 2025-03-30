/// <reference path='../Common/ArrayExtensions.ts'/>
/// <reference path='../Common/StringExtensions.ts'/>

import * as ko from 'knockout';
import AnnouncementViewModel from './AnnouncementViewModel';

const koRoot = document.getElementById('koroot');

const vm = new AnnouncementViewModel();

ko.applyBindings(vm, koRoot);