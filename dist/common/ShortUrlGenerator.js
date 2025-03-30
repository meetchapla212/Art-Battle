"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortUrlGenerator = void 0;
const shortid_1 = require("shortid");
const ShortUrl_1 = require("../models/ShortUrl");
class ShortUrlGenerator {
    async generateAndSaveUrl(url) {
        const urlHash = shortid_1.generate();
        const shortUrlModel = new ShortUrl_1.default({
            URL: url,
            Hash: urlHash
        });
        return await shortUrlModel.save();
    }
    async getOriginalUrl(urlHash) {
        return ShortUrl_1.default.findOne({
            Hash: urlHash
        });
    }
}
exports.ShortUrlGenerator = ShortUrlGenerator;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbW1vbi9TaG9ydFVybEdlbmVyYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxQ0FBbUM7QUFDbkMsaURBQStDO0FBRS9DLE1BQWEsaUJBQWlCO0lBQzFCLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxHQUFXO1FBQ2hDLE1BQU0sT0FBTyxHQUFHLGtCQUFRLEVBQUUsQ0FBQztRQUMzQixNQUFNLGFBQWEsR0FBRyxJQUFJLGtCQUFhLENBQUM7WUFDcEMsR0FBRyxFQUFFLEdBQUc7WUFDUixJQUFJLEVBQUUsT0FBTztTQUNoQixDQUFDLENBQUM7UUFDSCxPQUFPLE1BQU0sYUFBYSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ3RDLENBQUM7SUFFRCxLQUFLLENBQUMsY0FBYyxDQUFDLE9BQWU7UUFDaEMsT0FBTyxrQkFBYSxDQUFDLE9BQU8sQ0FBQztZQUN6QixJQUFJLEVBQUUsT0FBTztTQUNoQixDQUFDLENBQUM7SUFDUCxDQUFDO0NBQ0o7QUFmRCw4Q0FlQyIsImZpbGUiOiJjb21tb24vU2hvcnRVcmxHZW5lcmF0b3IuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBnZW5lcmF0ZSB9IGZyb20gJ3Nob3J0aWQnO1xuaW1wb3J0IFNob3J0VXJsTW9kZWwgZnJvbSAnLi4vbW9kZWxzL1Nob3J0VXJsJztcblxuZXhwb3J0IGNsYXNzIFNob3J0VXJsR2VuZXJhdG9yIHtcbiAgICBhc3luYyBnZW5lcmF0ZUFuZFNhdmVVcmwodXJsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgdXJsSGFzaCA9IGdlbmVyYXRlKCk7XG4gICAgICAgIGNvbnN0IHNob3J0VXJsTW9kZWwgPSBuZXcgU2hvcnRVcmxNb2RlbCh7XG4gICAgICAgICAgICBVUkw6IHVybCxcbiAgICAgICAgICAgIEhhc2g6IHVybEhhc2hcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBhd2FpdCBzaG9ydFVybE1vZGVsLnNhdmUoKTtcbiAgICB9XG5cbiAgICBhc3luYyBnZXRPcmlnaW5hbFVybCh1cmxIYXNoOiBzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIFNob3J0VXJsTW9kZWwuZmluZE9uZSh7XG4gICAgICAgICAgICBIYXNoOiB1cmxIYXNoXG4gICAgICAgIH0pO1xuICAgIH1cbn0iXX0=
