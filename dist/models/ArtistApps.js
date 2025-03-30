"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtistAppsSchema = exports.artistAppsSchema = void 0;
const mongoose = require("mongoose");
exports.artistAppsSchema = {
    'Name': String,
    'Email': String,
    'City': String,
    'Website': String,
    'PhoneNumber': String,
    'EntryId': String,
    'UserIP': String,
    'Processed': Boolean,
    'EntryDate': Date,
    'IpInfo': new mongoose.Schema({
        ip: String,
        type: String,
        continent_code: String,
        continent_name: String,
        country_code: String,
        country_name: String,
        region_code: String,
        region_name: String,
        city: String,
        zip: String,
        latitude: Number,
        longitude: Number,
        location: {
            geoname_id: Number,
            capital: String,
            languages: [{
                    code: String,
                    name: String,
                    native: String,
                }],
            country_flag: String,
            country_flag_emoji: String,
            country_flag_emoji_unicode: String,
            calling_code: String,
            is_eu: Boolean
        }
    })
};
exports.ArtistAppsSchema = new mongoose.Schema(exports.artistAppsSchema);
const ArtistAppsModel = mongoose.model('artistapps', exports.ArtistAppsSchema);
exports.default = ArtistAppsModel;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1vZGVscy9BcnRpc3RBcHBzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFDQUFxQztBQU14QixRQUFBLGdCQUFnQixHQUFHO0lBQzlCLE1BQU0sRUFBRSxNQUFNO0lBQ2QsT0FBTyxFQUFFLE1BQU07SUFDZixNQUFNLEVBQUUsTUFBTTtJQUNkLFNBQVMsRUFBRSxNQUFNO0lBQ2pCLGFBQWEsRUFBRSxNQUFNO0lBQ3JCLFNBQVMsRUFBRSxNQUFNO0lBQ2pCLFFBQVEsRUFBRSxNQUFNO0lBQ2hCLFdBQVcsRUFBRSxPQUFPO0lBQ3BCLFdBQVcsRUFBRSxJQUFJO0lBQ2pCLFFBQVEsRUFBRSxJQUFJLFFBQVEsQ0FBQyxNQUFNLENBQUM7UUFDNUIsRUFBRSxFQUFFLE1BQU07UUFDVixJQUFJLEVBQUUsTUFBTTtRQUNaLGNBQWMsRUFBRSxNQUFNO1FBQ3RCLGNBQWMsRUFBRSxNQUFNO1FBQ3RCLFlBQVksRUFBRSxNQUFNO1FBQ3BCLFlBQVksRUFBRSxNQUFNO1FBQ3BCLFdBQVcsRUFBRSxNQUFNO1FBQ25CLFdBQVcsRUFBRSxNQUFNO1FBQ25CLElBQUksRUFBRSxNQUFNO1FBQ1osR0FBRyxFQUFFLE1BQU07UUFDWCxRQUFRLEVBQUUsTUFBTTtRQUNoQixTQUFTLEVBQUUsTUFBTTtRQUNqQixRQUFRLEVBQUU7WUFDUixVQUFVLEVBQUUsTUFBTTtZQUNsQixPQUFPLEVBQUUsTUFBTTtZQUNmLFNBQVMsRUFBRSxDQUFDO29CQUNWLElBQUksRUFBRSxNQUFNO29CQUNaLElBQUksRUFBRSxNQUFNO29CQUNaLE1BQU0sRUFBRSxNQUFNO2lCQUFJLENBQUM7WUFDckIsWUFBWSxFQUFFLE1BQU07WUFDcEIsa0JBQWtCLEVBQUUsTUFBTTtZQUMxQiwwQkFBMEIsRUFBRSxNQUFNO1lBQ2xDLFlBQVksRUFBRSxNQUFNO1lBQ3BCLEtBQUssRUFBRSxPQUFPO1NBQ2Y7S0FDRixDQUFDO0NBQ0gsQ0FBQztBQUNXLFFBQUEsZ0JBQWdCLEdBQW9CLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyx3QkFBZ0IsQ0FBQyxDQUFDO0FBRXZGLE1BQU0sZUFBZSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQXFCLFlBQVksRUFBRSx3QkFBZ0IsQ0FBQyxDQUFDO0FBQzNGLGtCQUFlLGVBQWUsQ0FBQyIsImZpbGUiOiJtb2RlbHMvQXJ0aXN0QXBwcy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIG1vbmdvb3NlIGZyb20gJ21vbmdvb3NlJztcblxuaW1wb3J0IEFydGlzdEFwcHNEVE8gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL0FydGlzdEFwcHNEVE8nO1xuZXhwb3J0IGludGVyZmFjZSBBcnRpc3RBcHBzRG9jdW1lbnQgZXh0ZW5kcyBBcnRpc3RBcHBzRFRPLCBtb25nb29zZS5Eb2N1bWVudCB7XG59XG5cbmV4cG9ydCBjb25zdCBhcnRpc3RBcHBzU2NoZW1hID0ge1xuICAnTmFtZSc6IFN0cmluZyxcbiAgJ0VtYWlsJzogU3RyaW5nLFxuICAnQ2l0eSc6IFN0cmluZyxcbiAgJ1dlYnNpdGUnOiBTdHJpbmcsXG4gICdQaG9uZU51bWJlcic6IFN0cmluZyxcbiAgJ0VudHJ5SWQnOiBTdHJpbmcsXG4gICdVc2VySVAnOiBTdHJpbmcsXG4gICdQcm9jZXNzZWQnOiBCb29sZWFuLFxuICAnRW50cnlEYXRlJzogRGF0ZSxcbiAgJ0lwSW5mbyc6IG5ldyBtb25nb29zZS5TY2hlbWEoe1xuICAgIGlwOiBTdHJpbmcsXG4gICAgdHlwZTogU3RyaW5nLFxuICAgIGNvbnRpbmVudF9jb2RlOiBTdHJpbmcsXG4gICAgY29udGluZW50X25hbWU6IFN0cmluZyxcbiAgICBjb3VudHJ5X2NvZGU6IFN0cmluZyxcbiAgICBjb3VudHJ5X25hbWU6IFN0cmluZyxcbiAgICByZWdpb25fY29kZTogU3RyaW5nLFxuICAgIHJlZ2lvbl9uYW1lOiBTdHJpbmcsXG4gICAgY2l0eTogU3RyaW5nLFxuICAgIHppcDogU3RyaW5nLFxuICAgIGxhdGl0dWRlOiBOdW1iZXIsXG4gICAgbG9uZ2l0dWRlOiBOdW1iZXIsXG4gICAgbG9jYXRpb246IHtcbiAgICAgIGdlb25hbWVfaWQ6IE51bWJlcixcbiAgICAgIGNhcGl0YWw6IFN0cmluZyxcbiAgICAgIGxhbmd1YWdlczogW3tcbiAgICAgICAgY29kZTogU3RyaW5nLFxuICAgICAgICBuYW1lOiBTdHJpbmcsXG4gICAgICAgIG5hdGl2ZTogU3RyaW5nLCAgfV0sXG4gICAgICBjb3VudHJ5X2ZsYWc6IFN0cmluZyxcbiAgICAgIGNvdW50cnlfZmxhZ19lbW9qaTogU3RyaW5nLFxuICAgICAgY291bnRyeV9mbGFnX2Vtb2ppX3VuaWNvZGU6IFN0cmluZyxcbiAgICAgIGNhbGxpbmdfY29kZTogU3RyaW5nLFxuICAgICAgaXNfZXU6IEJvb2xlYW5cbiAgICB9XG4gIH0pXG59O1xuZXhwb3J0IGNvbnN0IEFydGlzdEFwcHNTY2hlbWE6IG1vbmdvb3NlLlNjaGVtYSA9IG5ldyBtb25nb29zZS5TY2hlbWEoYXJ0aXN0QXBwc1NjaGVtYSk7XG5cbmNvbnN0IEFydGlzdEFwcHNNb2RlbCA9IG1vbmdvb3NlLm1vZGVsPEFydGlzdEFwcHNEb2N1bWVudD4oJ2FydGlzdGFwcHMnLCBBcnRpc3RBcHBzU2NoZW1hKTtcbmV4cG9ydCBkZWZhdWx0IEFydGlzdEFwcHNNb2RlbDtcbiJdfQ==
