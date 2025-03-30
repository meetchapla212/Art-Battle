"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionStatesTitle = exports.AuctionStatesCss = exports.CopyWinnerStateCss = exports.CopyWinnerStates = exports.AutoCloseStateCss = exports.AutoCloseStates = exports.AuctionAdminCss = exports.AuctionAdminStats = exports.StateVoteFactorMap = exports.StateColors = exports.States = void 0;
exports.States = [
    'Online',
    'Photo',
    'Multi',
    'Artist',
    '1.5x',
    '2x',
    '5x',
    'Admin',
    'Phone'
];
exports.StateColors = [
    '#D14B19',
    '#DF3250',
    '#D73383',
    '#ef3f7b',
    '#B74CB0',
    '#7D66CF',
    '#0078DA',
    '#0044DA',
    '#ee9e80',
];
exports.StateVoteFactorMap = [
    0.25,
    -1.0,
    0.99,
    2.0,
    1.5,
    2.0,
    5.0,
    -1.0,
    0.05
];
exports.AuctionAdminStats = [
    'Open',
    'Close',
    'Enable',
    'Failed'
];
exports.AuctionAdminCss = [
    'btn-success',
    'btn-danger',
    'btn-default',
    'btn-danger'
];
exports.AutoCloseStates = [
    'Auto Close Auction After 15 Minutes',
    `Confirm? Start closing at: ${new Date(new Date().getTime() + 15 * 60 * 1000).toLocaleTimeString()}`,
    'Sending Messages..',
    'Disable Auto Close',
    'Disabling',
    'Failed',
    'All auction lots closed'
];
exports.AutoCloseStateCss = [
    'btn-success',
    'btn-primary',
    'btn-warning',
    'btn-danger',
    'btn-warning',
    'btn-danger',
    'btn-default'
];
exports.CopyWinnerStates = [
    'Copy X winners to round',
    'Success',
    'Failed'
];
exports.CopyWinnerStateCss = [
    'btn-info',
    'btn-success',
    'btn-danger',
];
exports.AuctionStatesCss = [
    '🔴',
    '🟢',
    '⚪' // disabled 2
];
exports.AuctionStatesTitle = [
    'Auction Closed',
    'Auction Open',
    'Auction not enabled' // disabled 2
];

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbW1vbi9TdGF0ZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQWEsUUFBQSxNQUFNLEdBQUc7SUFDbEIsUUFBUTtJQUNSLE9BQU87SUFDUCxPQUFPO0lBQ1AsUUFBUTtJQUNSLE1BQU07SUFDTixJQUFJO0lBQ0osSUFBSTtJQUNKLE9BQU87SUFDUCxPQUFPO0NBQ1YsQ0FBQztBQUVXLFFBQUEsV0FBVyxHQUFHO0lBQ3ZCLFNBQVM7SUFDVCxTQUFTO0lBQ1QsU0FBUztJQUNULFNBQVM7SUFDVCxTQUFTO0lBQ1QsU0FBUztJQUNULFNBQVM7SUFDVCxTQUFTO0lBQ1QsU0FBUztDQUNaLENBQUM7QUFFVyxRQUFBLGtCQUFrQixHQUFHO0lBQzlCLElBQUk7SUFDSixDQUFDLEdBQUc7SUFDSixJQUFJO0lBQ0osR0FBRztJQUNILEdBQUc7SUFDSCxHQUFHO0lBQ0gsR0FBRztJQUNILENBQUMsR0FBRztJQUNKLElBQUk7Q0FDUCxDQUFDO0FBRVcsUUFBQSxpQkFBaUIsR0FBRztJQUM3QixNQUFNO0lBQ04sT0FBTztJQUNQLFFBQVE7SUFDUixRQUFRO0NBQ1gsQ0FBQztBQUVXLFFBQUEsZUFBZSxHQUFHO0lBQzNCLGFBQWE7SUFDYixZQUFZO0lBQ1osYUFBYTtJQUNiLFlBQVk7Q0FDZixDQUFDO0FBRVcsUUFBQSxlQUFlLEdBQUc7SUFDM0IscUNBQXFDO0lBQ3JDLDhCQUE4QixJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUMsa0JBQWtCLEVBQUUsRUFBRTtJQUNwRyxvQkFBb0I7SUFDcEIsb0JBQW9CO0lBQ3BCLFdBQVc7SUFDWCxRQUFRO0lBQ1IseUJBQXlCO0NBQzVCLENBQUM7QUFFVyxRQUFBLGlCQUFpQixHQUFHO0lBQzdCLGFBQWE7SUFDYixhQUFhO0lBQ2IsYUFBYTtJQUNiLFlBQVk7SUFDWixhQUFhO0lBQ2IsWUFBWTtJQUNaLGFBQWE7Q0FDaEIsQ0FBQztBQUVXLFFBQUEsZ0JBQWdCLEdBQUc7SUFDNUIseUJBQXlCO0lBQ3pCLFNBQVM7SUFDVCxRQUFRO0NBQ1gsQ0FBQztBQUVXLFFBQUEsa0JBQWtCLEdBQUc7SUFDOUIsVUFBVTtJQUNWLGFBQWE7SUFDYixZQUFZO0NBQ2YsQ0FBQztBQUVXLFFBQUEsZ0JBQWdCLEdBQUc7SUFDNUIsSUFBSTtJQUNKLElBQUk7SUFDSixHQUFHLENBQUMsYUFBYTtDQUNwQixDQUFDO0FBRVcsUUFBQSxrQkFBa0IsR0FBRztJQUM5QixnQkFBZ0I7SUFDaEIsY0FBYztJQUNkLHFCQUFxQixDQUFDLGFBQWE7Q0FDdEMsQ0FBQyIsImZpbGUiOiJjb21tb24vU3RhdGVzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IFN0YXRlcyA9IFtcbiAgICAnT25saW5lJywgLy8gMC4yNVxuICAgICdQaG90bycsIC8vID4gMVxuICAgICdNdWx0aScsIC8vIDAuOTlcbiAgICAnQXJ0aXN0JywgLy8gMlxuICAgICcxLjV4JywgLy8gMS41XG4gICAgJzJ4JywgLy8gMlxuICAgICc1eCcsIC8vIDVcbiAgICAnQWRtaW4nLCAvLyBzdHJpbmdcbiAgICAnUGhvbmUnXG5dO1xuXG5leHBvcnQgY29uc3QgU3RhdGVDb2xvcnMgPSBbXG4gICAgJyNEMTRCMTknLFxuICAgICcjREYzMjUwJyxcbiAgICAnI0Q3MzM4MycsXG4gICAgJyNlZjNmN2InLFxuICAgICcjQjc0Q0IwJyxcbiAgICAnIzdENjZDRicsXG4gICAgJyMwMDc4REEnLFxuICAgICcjMDA0NERBJyxcbiAgICAnI2VlOWU4MCcsXG5dO1xuXG5leHBvcnQgY29uc3QgU3RhdGVWb3RlRmFjdG9yTWFwID0gW1xuICAgIDAuMjUsXG4gICAgLTEuMCxcbiAgICAwLjk5LFxuICAgIDIuMCxcbiAgICAxLjUsXG4gICAgMi4wLFxuICAgIDUuMCxcbiAgICAtMS4wLFxuICAgIDAuMDVcbl07XG5cbmV4cG9ydCBjb25zdCBBdWN0aW9uQWRtaW5TdGF0cyA9IFtcbiAgICAnT3BlbicsXG4gICAgJ0Nsb3NlJyxcbiAgICAnRW5hYmxlJyxcbiAgICAnRmFpbGVkJ1xuXTtcblxuZXhwb3J0IGNvbnN0IEF1Y3Rpb25BZG1pbkNzcyA9IFtcbiAgICAnYnRuLXN1Y2Nlc3MnLFxuICAgICdidG4tZGFuZ2VyJyxcbiAgICAnYnRuLWRlZmF1bHQnLFxuICAgICdidG4tZGFuZ2VyJ1xuXTtcblxuZXhwb3J0IGNvbnN0IEF1dG9DbG9zZVN0YXRlcyA9IFtcbiAgICAnQXV0byBDbG9zZSBBdWN0aW9uIEFmdGVyIDE1IE1pbnV0ZXMnLFxuICAgIGBDb25maXJtPyBTdGFydCBjbG9zaW5nIGF0OiAke25ldyBEYXRlKG5ldyBEYXRlKCkuZ2V0VGltZSgpICsgMTUgKiA2MCAqIDEwMDApLnRvTG9jYWxlVGltZVN0cmluZygpfWAsXG4gICAgJ1NlbmRpbmcgTWVzc2FnZXMuLicsXG4gICAgJ0Rpc2FibGUgQXV0byBDbG9zZScsXG4gICAgJ0Rpc2FibGluZycsXG4gICAgJ0ZhaWxlZCcsXG4gICAgJ0FsbCBhdWN0aW9uIGxvdHMgY2xvc2VkJ1xuXTtcblxuZXhwb3J0IGNvbnN0IEF1dG9DbG9zZVN0YXRlQ3NzID0gW1xuICAgICdidG4tc3VjY2VzcycsXG4gICAgJ2J0bi1wcmltYXJ5JyxcbiAgICAnYnRuLXdhcm5pbmcnLFxuICAgICdidG4tZGFuZ2VyJyxcbiAgICAnYnRuLXdhcm5pbmcnLFxuICAgICdidG4tZGFuZ2VyJyxcbiAgICAnYnRuLWRlZmF1bHQnXG5dO1xuXG5leHBvcnQgY29uc3QgQ29weVdpbm5lclN0YXRlcyA9IFtcbiAgICAnQ29weSBYIHdpbm5lcnMgdG8gcm91bmQnLFxuICAgICdTdWNjZXNzJyxcbiAgICAnRmFpbGVkJ1xuXTtcblxuZXhwb3J0IGNvbnN0IENvcHlXaW5uZXJTdGF0ZUNzcyA9IFtcbiAgICAnYnRuLWluZm8nLFxuICAgICdidG4tc3VjY2VzcycsXG4gICAgJ2J0bi1kYW5nZXInLFxuXTtcblxuZXhwb3J0IGNvbnN0IEF1Y3Rpb25TdGF0ZXNDc3MgPSBbXG4gICAgJ/CflLQnLCAvLyBjbG9zZWQgMFxuICAgICfwn5+iJywgLy8gb3BlbiAxXG4gICAgJ+KaqicgLy8gZGlzYWJsZWQgMlxuXTtcblxuZXhwb3J0IGNvbnN0IEF1Y3Rpb25TdGF0ZXNUaXRsZSA9IFtcbiAgICAnQXVjdGlvbiBDbG9zZWQnLCAvLyBjbG9zZWQgMFxuICAgICdBdWN0aW9uIE9wZW4nLCAvLyBvcGVuIDFcbiAgICAnQXVjdGlvbiBub3QgZW5hYmxlZCcgLy8gZGlzYWJsZWQgMlxuXTsiXX0=
