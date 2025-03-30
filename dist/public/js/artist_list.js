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

    var ArtistListViewModel = /** @class */ (function () {
        function ArtistListViewModel(auth) {
            this.Auth = ko$1.observable();
            // @ts-ignore comes from html
            this.List = artistList;
            this.Artists = ko$1.observableArray([]);
            this.Auth(auth);
            for (var i = 0; i < this.List.length; i++) {
                this.Artists.push(new Artist(this.List[i]));
            }
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
