export const States = [
    'Online', // 0.25
    'Photo', // > 1
    'Multi', // 0.99
    'Artist', // 2
    '1.5x', // 1.5
    '2x', // 2
    '5x', // 5
    'Admin', // string
    'Phone'
];

export const StateColors = [
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

export const StateVoteFactorMap = [
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

export const AuctionAdminStats = [
    'Open',
    'Close',
    'Enable',
    'Failed'
];

export const AuctionAdminCss = [
    'btn-success',
    'btn-danger',
    'btn-default',
    'btn-danger'
];

export const AutoCloseStates = [
    'Auto Close Auction After 15 Minutes',
    `Confirm? Start closing at: ${new Date(new Date().getTime() + 15 * 60 * 1000).toLocaleTimeString()}`,
    'Sending Messages..',
    'Disable Auto Close',
    'Disabling',
    'Failed',
    'All auction lots closed'
];

export const AutoCloseStateCss = [
    'btn-success',
    'btn-primary',
    'btn-warning',
    'btn-danger',
    'btn-warning',
    'btn-danger',
    'btn-default'
];

export const CopyWinnerStates = [
    'Copy X winners to round',
    'Success',
    'Failed'
];

export const CopyWinnerStateCss = [
    'btn-info',
    'btn-success',
    'btn-danger',
];

export const AuctionStatesCss = [
    '🔴', // closed 0
    '🟢', // open 1
    '⚪' // disabled 2
];

export const AuctionStatesTitle = [
    'Auction Closed', // closed 0
    'Auction Open', // open 1
    'Auction not enabled' // disabled 2
];