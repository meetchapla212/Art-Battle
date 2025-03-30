const fs = require('fs');
const countries = require('./countries_raw');
const countriesNew = [];
for (let i = 0; i < countries.length; i++) {
    const countryName = countries[i].name;
    const alpha2Code = countries[i].alpha2Code;
    const countryCode = `+${countries[i].callingCodes[0]}`;
    const countryId = i + 1;
    if (countryName && alpha2Code && countryCode && countryId)
    countriesNew.push({
        countryName,
        alpha2Code,
        countryCode,
        countryId
    });
}
const countryJson = JSON.stringify(countriesNew, null, 1);
fs.writeFile('./newCountryList.json', countryJson, () => console.log('done'));
