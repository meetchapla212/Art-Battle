/// <reference path='../Common/ArrayExtensions.ts'/>
/// <reference path='../Common/StringExtensions.ts'/>

import * as ko from 'knockout';
import RegistrationScreenViewModel from './RegistrationScreenViewModel';

const koRoot = document.getElementById('koroot');

const vm = new RegistrationScreenViewModel();

ko.applyBindings(vm, koRoot);