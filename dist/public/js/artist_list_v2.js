(function (ko$1) {
    'use strict';

    var Artist = /** @class */ (function () {
        function Artist(dto) {
            this.SelectedImageIndex = ko.observable();
            this.SelectedImage = ko.observable();
            this.Name = dto.Name.split(' ');
            if (this.Name[1] === '-') {
                this.Name[1] = '';
            }
            this.Link = dto.Link;
            this.Images = dto.Images;
            this.SelectedImage(this.Images[0]);
        }
        Artist.prototype.CycleImage = function () {
            var index = this.SelectedImageIndex() - 1;
            if (index >= 0) {
                this.SelectedImageIndex(index);
            }
            else {
                index = this.Images.length - 1;
                this.SelectedImageIndex(index);
            }
            this.SelectedImage(this.Images[index]);
        };
        return Artist;
    }());

    var PaginatedLoader = /** @class */ (function () {
        function PaginatedLoader(FullList) {
            this.DisplayList = ko.observableArray();
            this.MoreText = ko.observable();
            this.CurrentPage = 0;
            this.Step = 10;
            this.TotalPages = 1;
            this.ListLength = 0;
            this.Direction = 1; // 1 = more, 0 = less
            console.log('FullList', FullList);
            this.FullList = FullList;
            this.ListLength = FullList.length;
            if (this.ListLength > 10) {
                this.CurrentPage++;
                this.TotalPages = Math.ceil(this.ListLength / this.Step);
                this.handleStart();
                this.updateDisplayList();
                console.log('this.ListLength / this.Step', this.ListLength / this.Step, this.TotalPages);
            }
        }
        // used in view
        PaginatedLoader.prototype.navigate = function () {
            if (this.Direction === 1) {
                this.CurrentPage++;
                this.updateDisplayList();
                this.handleEnd();
            }
            else {
                this.CurrentPage--;
                this.updateDisplayList();
                this.handleStart();
            }
        };
        PaginatedLoader.prototype.handleEnd = function () {
            if (this.TotalPages === this.CurrentPage) {
                this.MoreText('Less');
                this.Direction = 0;
            }
        };
        PaginatedLoader.prototype.updateDisplayList = function () {
            console.log('this.CurrentPage', this.CurrentPage, this.Direction, this.Step, this.Step * ((this.CurrentPage - 1) + this.Direction));
            this.DisplayList(this.FullList.slice(0, this.Step * ((this.CurrentPage - 1) + 1)));
            this.DisplayList.notifySubscribers();
        };
        PaginatedLoader.prototype.handleStart = function () {
            if (this.CurrentPage === 1) {
                this.Direction = 1;
                this.MoreText('More');
            }
        };
        return PaginatedLoader;
    }());

    var ArtistListViewModel = /** @class */ (function () {
        function ArtistListViewModel(auth) {
            this.Auth = ko$1.observable();
            // @ts-ignore comes from html
            this.List = artistList;
            // @ts-ignore comes from html
            this.FollowingArtistsList = followingArtist;
            this.FollowingArtists = ko$1.observableArray([]);
            this.FullArtists = ko$1.observableArray([]);
            // @ts-ignore
            this.Artists = ko$1.observableArray([]);
            this.Auth(auth);
            for (var i = 0; i < this.List.length; i++) {
                var artistObj = new Artist(this.List[i]);
                this.FullArtists.push(artistObj);
            }
            for (var j = 0; j < this.FollowingArtistsList.length; j++) {
                this.FollowingArtists.push(new Artist(this.FollowingArtistsList[j]));
            }
            this.PaginatedTopArtists = new PaginatedLoader(this.FullArtists());
            this.PaginatedFollowingArtists = new PaginatedLoader(this.FollowingArtists());
        }
        return ArtistListViewModel;
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
    var vm = new ArtistListViewModel(auth);
    ko$1.applyBindings(vm, koRoot);

}(ko));
