/// <reference path='../Common/ArrayExtensions.ts'/>
/// <reference path='../Common/StringExtensions.ts'/>

import * as ko from 'knockout';
import { ArtistPublicProfileViewModel } from './ArtistPublicProfileViewModel';
import { JWTAuth } from '../Utils/JWTAuth';

const koRoot = document.getElementById('koroot');
const auth = new JWTAuth();
// @ts-ignore token comes from global JS
auth.set(token);

const vm = new ArtistPublicProfileViewModel(auth);

ko.applyBindings(vm, koRoot);